package com.example.ats.web;

import com.example.ats.entity.Application;
import com.example.ats.entity.Job;
import jakarta.persistence.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

import java.util.*;
import java.util.logging.Logger;

@Path("/applications")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ApplicationResource {
    private static volatile EntityManagerFactory EMF; // cache
    private static final Logger LOG = Logger.getLogger(ApplicationResource.class.getName());

    private EntityManagerFactory getEmf(){
        EntityManagerFactory local = EMF;
        if(local == null){
            synchronized (ApplicationResource.class){
                local = EMF;
                if(local == null){
                    EMF = local = jakarta.persistence.Persistence.createEntityManagerFactory("ATS-PU");
                }
            }
        }
        return local;
    }

    // Return applicants for a given job
    @GET
    @Path("jobs/{jobId}/applicants")
    public Response listApplicantsForJob(@PathParam("jobId") Long jobId){
        List<Map<String,Object>> out = new ArrayList<>();
        if (jobId == null) return Response.ok(out).build();
        EntityManager em = null;
        try {
            em = getEmf().createEntityManager();
            // Query applications table which has denormalized applicant data
            String sql = "SELECT a.id, a.applicant_user_id, a.applicant_name, a.applicant_email, a.applicant_phone, " +
                         "a.status, a.submitted_at, a.cv_path, a.match_score, a.cover_letter " +
                         "FROM applications a " +
                         "WHERE a.job_id = ?1 " +
                         "ORDER BY a.submitted_at DESC NULLS LAST, a.id DESC";

            @SuppressWarnings("unchecked")
            List<Object[]> rows = em.createNativeQuery(sql).setParameter(1, jobId).getResultList();

            for(Object[] r : rows){
                Map<String,Object> m = new HashMap<>();
                m.put("id", r[0] != null ? ((Number)r[0]).longValue() : null);  // application ID
                m.put("applicantUserId", r[1] != null ? ((Number)r[1]).longValue() : null);
                m.put("name", r[2]);
                m.put("email", r[3]);
                m.put("phone", r[4]);

                // Map status to frontend format
                String st = r[5] != null ? r[5].toString().toLowerCase(Locale.ROOT) : "submitted";
                m.put("status", st);

                // Format submitted date
                Object submitted = r[6];
                String iso = null;
                if (submitted instanceof java.sql.Timestamp ts){
                    iso = ts.toInstant().toString();
                } else if (submitted != null){
                    iso = submitted.toString();
                }
                m.put("appliedDate", iso);

                m.put("cvPath", r[7]);
                m.put("matchScore", r[8]);
                m.put("coverLetter", r[9]);

                out.add(m);
            }
            return Response.ok(out).build();
        } catch(Exception e){
            LOG.severe("Error fetching applicants for job " + jobId + ": " + e.getClass().getName() + ": " + e.getMessage());
            e.printStackTrace();
            return Response.ok(out).build();
        } finally {
            if (em != null){
                try { em.close(); } catch(Exception ignore){}
            }
        }
    }

    // Update application status to accepted (for "Move to Next Round")
    @POST
    @Path("applications/{applicationId}/accept")
    public Response accept(@PathParam("applicationId") Long applicationId){
        return updateApplicationStatus(applicationId, "accepted", false);
    }

    // Update application status to rejected
    @POST
    @Path("applications/{applicationId}/reject")
    public Response reject(@PathParam("applicationId") Long applicationId){
        return updateApplicationStatus(applicationId, "rejected", true);  // Send notification
    }

    private Response updateApplicationStatus(Long applicationId, String status, boolean sendNotification){
        if (applicationId == null){
            Map<String,Object> err = Map.of("status","error","reason","Missing applicationId");
            return Response.status(Response.Status.BAD_REQUEST).entity(err).build();
        }
        EntityManager em = null;
        EntityTransaction tx = null;
        try {
            em = getEmf().createEntityManager();
            tx = em.getTransaction();
            tx.begin();

            // Update application status with proper enum cast
            String updateSql = "UPDATE applications SET status = CAST(?1 AS application_status), updated_at = NOW() WHERE id = ?2";
            int updated = em.createNativeQuery(updateSql)
                    .setParameter(1, status)
                    .setParameter(2, applicationId)
                    .executeUpdate();

            // If rejection, create notification
            if (sendNotification && updated > 0) {
                String getSql = "SELECT applicant_name, applicant_email, job_id FROM applications WHERE id = ?1";
                Object[] appData = (Object[]) em.createNativeQuery(getSql)
                        .setParameter(1, applicationId)
                        .getSingleResult();

                String applicantName = appData[0] != null ? appData[0].toString() : "";
                String applicantEmail = appData[1] != null ? appData[1].toString() : "";
                Long jobId = appData[2] != null ? ((Number)appData[2]).longValue() : null;

                // Get job title
                String jobTitle = "the position";
                if (jobId != null) {
                    try {
                        Object titleObj = em.createNativeQuery("SELECT title FROM jobs WHERE id = ?1")
                                .setParameter(1, jobId)
                                .getSingleResult();
                        if (titleObj != null) jobTitle = titleObj.toString();
                    } catch (Exception e) {
                        // Ignore if job not found
                    }
                }

                // Create rejection notification
                String subject = "Application Update - " + jobTitle;
                String body = String.format(
                    "Dear %s,\n\nThank you for your interest in %s. " +
                    "After careful consideration, we have decided to move forward with other candidates " +
                    "whose qualifications more closely match our current needs.\n\n" +
                    "We appreciate the time you invested in the application process and wish you success in your job search.\n\n" +
                    "Best regards,\nTalent Flow Team",
                    applicantName, jobTitle
                );

                em.createNativeQuery(
                    "INSERT INTO notifications (application_id, notification_type, to_email, subject, body, sent_at) " +
                    "VALUES (?1, CAST(?2 AS notification_type), ?3, ?4, ?5, NOW())")
                    .setParameter(1, applicationId)
                    .setParameter(2, "rejection_email")
                    .setParameter(3, applicantEmail)
                    .setParameter(4, subject)
                    .setParameter(5, body)
                    .executeUpdate();
            }

            tx.commit();

            Map<String,Object> ok = new HashMap<>();
            ok.put("status", "ok");
            ok.put("updated", updated);
            return Response.ok(ok).build();
        } catch(Exception e){
            if (tx != null && tx.isActive()) try { tx.rollback(); } catch(Exception ignore){}
            LOG.severe("Error updating application status: " + e.getMessage());
            e.printStackTrace();
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", e.getClass().getName() + ": " + e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(err).build();
        } finally {
            if (em != null){
                try { em.close(); } catch(Exception ignore){}
            }
        }
    }

    @GET
    @Path("/applicant/{applicantId}")
    public Response getApplicantApplications(@PathParam("applicantId") Long applicantId){
        try {
            EntityManager em = getEmf().createEntityManager();

            // Query to get all applications for this applicant with job details
            String jpql = "SELECT a FROM Application a WHERE a.applicantUserId = :applicantId ORDER BY a.submittedAt DESC";
            List<Application> applications = em.createQuery(jpql, Application.class)
                    .setParameter("applicantId", applicantId)
                    .getResultList();

            // Convert to JSON-friendly format with job details
            var result = applications.stream().map(app -> {
                Map<String, Object> appData = new HashMap<>();
                appData.put("id", app.getId());
                appData.put("applicationRef", app.getApplicationRef());
                appData.put("jobId", app.getJobId());
                appData.put("status", app.getStatus() != null ? app.getStatus().name().toLowerCase() : "submitted");
                appData.put("submittedAt", app.getSubmittedAt());
                appData.put("coverLetter", app.getCoverLetter());
                appData.put("cvPath", app.getCvPath());
                appData.put("matchScore", app.getMatchScore());

                // Fetch job details
                try {
                    Job job = em.find(Job.class, app.getJobId());
                    if (job != null) {
                        Map<String, Object> jobData = new HashMap<>();
                        jobData.put("title", job.getTitle());
                        jobData.put("department", job.getDepartment());
                        jobData.put("location", job.getLocation());
                        jobData.put("employmentType", job.getEmploymentType() != null ? job.getEmploymentType().name() : null);
                        appData.put("job", jobData);
                    }
                } catch (Exception e) {
                    // Job might have been deleted
                    appData.put("job", null);
                }

                return appData;
            }).toList();

            em.close();
            return Response.ok(result).build();

        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", e.getMessage())).build();
        }
    }
}
