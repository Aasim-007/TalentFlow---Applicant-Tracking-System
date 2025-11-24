package com.example.ats.web;

import com.example.ats.entity.*;
import jakarta.persistence.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.logging.Logger;

@Path("/interviews")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class InterviewResource {

    private static final Logger LOG = Logger.getLogger(InterviewResource.class.getName());
    private static volatile EntityManagerFactory EMF;

    @Context
    private HttpServletRequest servletRequest;

    private EntityManagerFactory getEmf() {
        EntityManagerFactory local = EMF;
        if (local == null) {
            synchronized (InterviewResource.class) {
                local = EMF;
                if (local == null) {
                    EMF = local = Persistence.createEntityManagerFactory("ATS-PU");
                }
            }
        }
        return local;
    }

    /**
     * Get all applications for a specific job with status 'under_review', 'shortlisted' or 'interview_invite'
     * Used by manager to see who they can schedule interviews for
     */
    @GET
    @Path("/jobs/{jobId}/shortlisted-applicants")
    public Response getShortlistedApplicants(@PathParam("jobId") Long jobId) {
        EntityManager em = null;
        try {
            em = getEmf().createEntityManager();
            final EntityManager finalEm = em; // Make final for lambda

            LOG.info("Fetching applicants for job ID: " + jobId);

            // Use native SQL query with explicit cast to PostgreSQL enum type
            String sql = "SELECT a.id, a.applicant_user_id, a.applicant_name, a.applicant_email, a.applicant_phone, " +
                        "a.status, a.submitted_at, a.match_score, a.cv_path, a.application_ref " +
                        "FROM applications a " +
                        "WHERE a.job_id = ?1 " +
                        "AND (a.status = CAST(?2 AS application_status) " +
                        "OR a.status = CAST(?3 AS application_status) " +
                        "OR a.status = CAST(?4 AS application_status)) " +
                        "ORDER BY a.submitted_at DESC";

            @SuppressWarnings("unchecked")
            List<Object[]> rows = em.createNativeQuery(sql)
                    .setParameter(1, jobId)
                    .setParameter(2, "under_review")
                    .setParameter(3, "shortlisted")
                    .setParameter(4, "interview_invite")
                    .getResultList();

            LOG.info("Found " + rows.size() + " applications for job " + jobId);

            // Convert to JSON-friendly format
            var result = rows.stream().map(row -> {
                Map<String, Object> data = new HashMap<>();
                data.put("applicationId", row[0] != null ? ((Number)row[0]).longValue() : null);
                data.put("applicantUserId", row[1] != null ? ((Number)row[1]).longValue() : null);
                data.put("name", row[2]);
                data.put("email", row[3]);
                data.put("phone", row[4]);
                data.put("status", row[5] != null ? row[5].toString() : "submitted");
                data.put("submittedAt", row[6]);
                data.put("matchScore", row[7]);
                data.put("cvPath", row[8]);
                data.put("applicationRef", row[9]);

                // Check if interview already scheduled
                Long appId = row[0] != null ? ((Number)row[0]).longValue() : null;
                if (appId != null) {
                    try {
                        Long interviewCount = (Long) finalEm.createNativeQuery(
                            "SELECT COUNT(*) FROM interviews WHERE application_id = ?1")
                            .setParameter(1, appId)
                            .getSingleResult();
                        data.put("hasInterview", interviewCount > 0);
                    } catch (Exception e) {
                        data.put("hasInterview", false);
                    }
                } else {
                    data.put("hasInterview", false);
                }

                return data;
            }).toList();

            return Response.ok(result).build();

        } catch (Exception e) {
            LOG.severe("Error fetching shortlisted applicants: " + e.getMessage());
            e.printStackTrace();
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", e.getMessage())).build();
        } finally {
            if (em != null) em.close();
        }
    }

    /**
     * Schedule a new interview
     */
    @POST
    public Response createInterview(Map<String, Object> requestData) {
        EntityManager em = null;
        EntityTransaction tx = null;

        try {
            em = getEmf().createEntityManager();
            tx = em.getTransaction();
            tx.begin();

            // Extract data
            Long applicationId = getLong(requestData, "application_id");
            Long jobId = getLong(requestData, "job_id");
            String scheduledStartStr = (String) requestData.get("scheduled_start");
            Integer durationMinutes = getInteger(requestData, "duration_minutes");
            String location = (String) requestData.get("location");
            String notes = (String) requestData.get("notes");

            if (applicationId == null || jobId == null || scheduledStartStr == null) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(Map.of("status", "error", "reason", "Missing required fields")).build();
            }

            // Parse scheduled start
            OffsetDateTime scheduledStart = OffsetDateTime.parse(scheduledStartStr);

            // Calculate scheduled end if duration provided
            OffsetDateTime scheduledEnd = null;
            if (durationMinutes != null && durationMinutes > 0) {
                scheduledEnd = scheduledStart.plusMinutes(durationMinutes);
            }

            // Get current user (manager) from session
            Long managerId = null;
            if (servletRequest != null) {
                var session = servletRequest.getSession(false);
                if (session != null) {
                    managerId = (Long) session.getAttribute("userId");
                }
            }

            // Use native SQL to insert interview with proper enum casting
            String insertSql = "INSERT INTO interviews " +
                    "(application_id, job_id, scheduled_start, scheduled_end, location, notes, " +
                    "status, created_by_user_id, created_at, updated_at) " +
                    "VALUES (?1, ?2, ?3, ?4, ?5, ?6, CAST(?7 AS interview_status), ?8, ?9, ?10)";

            OffsetDateTime now = OffsetDateTime.now();

            em.createNativeQuery(insertSql)
                    .setParameter(1, applicationId)
                    .setParameter(2, jobId)
                    .setParameter(3, java.sql.Timestamp.from(scheduledStart.toInstant()))
                    .setParameter(4, scheduledEnd != null ? java.sql.Timestamp.from(scheduledEnd.toInstant()) : null)
                    .setParameter(5, location)
                    .setParameter(6, notes)
                    .setParameter(7, "scheduled")  // String value, will be cast to enum
                    .setParameter(8, managerId)
                    .setParameter(9, java.sql.Timestamp.from(now.toInstant()))
                    .setParameter(10, java.sql.Timestamp.from(now.toInstant()))
                    .executeUpdate();

            // Get the generated interview ID
            Long interviewId = ((Number) em.createNativeQuery("SELECT lastval()").getSingleResult()).longValue();

            // Update application status to 'interview_invite' using native SQL
            String updateAppSql = "UPDATE applications " +
                    "SET status = CAST(?1 AS application_status), updated_at = ?2 " +
                    "WHERE id = ?3";

            em.createNativeQuery(updateAppSql)
                    .setParameter(1, "interview_invite")
                    .setParameter(2, java.sql.Timestamp.from(now.toInstant()))
                    .setParameter(3, applicationId)
                    .executeUpdate();

            // Get application details for notification
            String getAppSql = "SELECT applicant_name, applicant_email FROM applications WHERE id = ?1";
            Object[] appData = (Object[]) em.createNativeQuery(getAppSql)
                    .setParameter(1, applicationId)
                    .getSingleResult();

            String applicantName = appData[0] != null ? appData[0].toString() : "";
            String applicantEmail = appData[1] != null ? appData[1].toString() : "";

            // Create notification for applicant
            createInterviewNotification(em, applicationId, applicantName, applicantEmail, scheduledStart, location);

            tx.commit();

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("interviewId", interviewId);
            response.put("message", "Interview scheduled successfully");

            return Response.ok(response).build();

        } catch (Exception e) {
            if (tx != null && tx.isActive()) {
                tx.rollback();
            }
            LOG.severe("Error creating interview: " + e.getMessage());
            e.printStackTrace();
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("status", "error", "reason", e.getMessage())).build();
        } finally {
            if (em != null) em.close();
        }
    }

    /**
     * Get interviews for an application (used by applicant to see their interviews)
     */
    @GET
    @Path("/application/{applicationId}")
    public Response getInterviewsForApplication(@PathParam("applicationId") Long applicationId) {
        EntityManager em = null;
        try {
            em = getEmf().createEntityManager();

            String jpql = "SELECT i FROM Interview i WHERE i.applicationId = :appId ORDER BY i.scheduledStart DESC";
            List<Interview> interviews = em.createQuery(jpql, Interview.class)
                    .setParameter("appId", applicationId)
                    .getResultList();

            var result = interviews.stream().map(interview -> {
                Map<String, Object> data = new HashMap<>();
                data.put("id", interview.getId());
                data.put("scheduledStart", interview.getScheduledStart());
                data.put("scheduledEnd", interview.getScheduledEnd());
                data.put("location", interview.getLocation());
                data.put("status", interview.getStatus() != null ? interview.getStatus().name().toLowerCase() : "scheduled");
                data.put("notes", interview.getNotes());
                return data;
            }).toList();

            return Response.ok(result).build();

        } catch (Exception e) {
            LOG.severe("Error fetching interviews: " + e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", e.getMessage())).build();
        } finally {
            if (em != null) em.close();
        }
    }

    private void createInterviewNotification(EntityManager em, Long applicationId, String applicantName,
                                             String applicantEmail, OffsetDateTime scheduledStart, String location) {
        if (applicantEmail == null || applicantEmail.isEmpty()) return;

        try {
            String subject = "Interview Scheduled - Job Application";
            String body = String.format(
                "Dear %s,\n\nYour interview has been scheduled.\n\nDetails:\nDate: %s\nLocation: %s\n\nGood luck!",
                applicantName != null ? applicantName : "Applicant",
                scheduledStart,
                location
            );

            // Use native query to insert notification
            em.createNativeQuery(
                "INSERT INTO notifications (application_id, notification_type, to_email, subject, body, sent_at) " +
                "VALUES (?1, CAST(?2 AS notification_type), ?3, ?4, ?5, ?6)")
                .setParameter(1, applicationId)
                .setParameter(2, "interview_invite")
                .setParameter(3, applicantEmail)
                .setParameter(4, subject)
                .setParameter(5, body)
                .setParameter(6, java.sql.Timestamp.from(OffsetDateTime.now().toInstant()))
                .executeUpdate();

            LOG.info("Interview notification created for application " + applicationId);
        } catch (Exception e) {
            LOG.warning("Failed to create notification: " + e.getMessage());
            // Don't fail the whole transaction for notification failure
        }
    }

    private Long getLong(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        if (val instanceof Number) return ((Number) val).longValue();
        try { return Long.parseLong(val.toString()); } catch (Exception e) { return null; }
    }

    private Integer getInteger(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        if (val instanceof Number) return ((Number) val).intValue();
        try { return Integer.parseInt(val.toString()); } catch (Exception e) { return null; }
    }
}

