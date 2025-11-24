package com.example.ats.web;

import com.example.ats.entity.Application;
import com.example.ats.entity.Interview;
import jakarta.persistence.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

import java.time.*;
import java.util.*;
import java.util.logging.Logger;

@Path("/interviews")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class InterviewResource {
    private static volatile EntityManagerFactory EMF;
    private static final Logger LOG = Logger.getLogger(InterviewResource.class.getName());

    private EntityManagerFactory getEmf(){
        EntityManagerFactory local = EMF;
        if (local == null){
            synchronized (InterviewResource.class){
                local = EMF;
                if (local == null){
                    EMF = local = Persistence.createEntityManagerFactory("ATS-PU");
                }
            }
        }
        return local;
    }

    // List accepted/shortlisted applicants for a given job
    @GET
    @Path("/jobs/{jobId}/accepted-applicants")
    public Response listAcceptedApplicantsForJob(@PathParam("jobId") Long jobId){
        if (jobId == null){
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("status","error","reason","Missing jobId"))
                    .build();
        }
        EntityManager em = null;
        try {
            em = getEmf().createEntityManager();
            // Use JPQL to fetch applications and join users via native query previously; keep similar JSON shape
            String ql = "SELECT a FROM Application a WHERE a.jobId = :jobId AND a.status IN :statuses ORDER BY a.submittedAt DESC";
            @SuppressWarnings("unchecked")
            List<Application> apps = em.createQuery(ql, Application.class).setParameter("jobId", jobId)
                    .setParameter("statuses", List.of("shortlisted","interview_invite"))
                    .getResultList();

            List<Map<String,Object>> out = new ArrayList<>();
            for (Application a : apps){
                Map<String,Object> m = new HashMap<>();
                m.put("applicationId", a.getId());
                m.put("applicantUserId", a.getApplicantUserId());
                // Try to resolve user name/email via users table join
                try {
                    Object[] row = (Object[]) em.createNativeQuery("SELECT u.name, u.email FROM users u WHERE u.id = ?1")
                            .setParameter(1, a.getApplicantUserId()).getSingleResult();
                    m.put("name", row[0]);
                    m.put("email", row[1]);
                } catch (NoResultException n){ m.put("name", null); m.put("email", null); }
                m.put("status", a.getStatus());
                m.put("submittedAt", a.getSubmittedAt() == null ? null : a.getSubmittedAt().toString());
                out.add(m);
            }
            return Response.ok(out).build();
        } catch (Exception e){
            LOG.severe("Failed listing accepted applicants: " + e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(Map.of(
                    "status","error","reason", e.getClass().getSimpleName()+": "+e.getMessage()
            )).build();
        } finally { if (em != null) try { em.close(); } catch(Exception ignore){} }
    }

    public static class CreateInterviewRequest{
        public Long application_id;
        public Long job_id;
        public String scheduled_start; // ISO-8601
        public String scheduled_end;   // optional ISO-8601
        public Integer duration_minutes; // optional alternative to scheduled_end
        public String location;
        public String notes; // free text (may include interviewer name)
        public Long interviewer_user_id; // optional
    }

    @POST
    public Response create(CreateInterviewRequest req, @Context HttpHeaders headers){
        // Basic validation
        if (req == null || req.application_id == null || req.job_id == null || req.scheduled_start == null || req.location == null || req.location.isBlank()){
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of(
                    "status","error",
                    "reason","Missing required fields"
            )).build();
        }

        OffsetDateTime start;
        OffsetDateTime end = null;
        try {
            start = OffsetDateTime.parse(req.scheduled_start);
        } catch(Exception e){
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of(
                    "status","error",
                    "reason","scheduled_start must be ISO-8601"
            )).build();
        }
        if (req.scheduled_end != null){
            try { end = OffsetDateTime.parse(req.scheduled_end); } catch(Exception e){
                return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("status","error","reason","scheduled_end must be ISO-8601")).build();
            }
        } else if (req.duration_minutes != null && req.duration_minutes > 0){
            end = start.plusMinutes(req.duration_minutes);
        }

        EntityManager em = null;
        EntityTransaction tx = null;
        try {
            em = getEmf().createEntityManager();
            tx = em.getTransaction();
            tx.begin();

            // Validate application belongs to job and acceptable status
            Application app = em.find(Application.class, req.application_id);
            if (app == null || !Objects.equals(app.getJobId(), req.job_id) || !("shortlisted".equals(app.getStatus()) || "interview_invite".equals(app.getStatus()))){
                tx.rollback();
                return Response.status(Response.Status.BAD_REQUEST).entity(Map.of(
                        "status","error",
                        "reason","Application not eligible for interview or mismatched job"
                )).build();
            }

            // created_by_user_id: try to extract from a simple header if provided by login flow
            Long createdBy = null;
            try {
                String uid = headers.getHeaderString("X-User-Id");
                if (uid != null && !uid.isBlank()) createdBy = Long.valueOf(uid.trim());
            } catch(Exception ignore){}

            Interview interview = new Interview();
            interview.setApplicationId(req.application_id);
            interview.setJobId(req.job_id);
            interview.setCreatedByUserId(createdBy);
            interview.setInterviewerUserId(req.interviewer_user_id);
            interview.setScheduledStart(start);
            interview.setScheduledEnd(end);
            interview.setLocation(req.location);
            interview.setNotes(req.notes);
            interview.setStatus("scheduled");
            interview.setCreatedAt(OffsetDateTime.now());

            em.persist(interview);

            // update application status to interview_invite
            app.setStatus("interview_invite");
            app.setUpdatedAt(OffsetDateTime.now());
            em.merge(app);

            tx.commit();

            Map<String,Object> out = new HashMap<>();
            out.put("status","success");
            out.put("interview_id", interview.getId());
            return Response.ok(out).build();
        } catch(Exception e){
            if (tx != null && tx.isActive()) try { tx.rollback(); } catch(Exception ignore){}
            LOG.severe("Failed to create interview: " + e.getClass().getName() + ": " + e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(Map.of(
                    "status","error",
                    "reason", e.getClass().getName() + ": " + e.getMessage()
            )).build();
        } finally {
            if (em != null) try { em.close(); } catch(Exception ignore){}
        }
    }
}
