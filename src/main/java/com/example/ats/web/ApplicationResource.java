package com.example.ats.web;

import com.example.ats.entity.Application;
import com.example.ats.entity.Job;
import jakarta.persistence.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

import java.util.*;
import java.util.logging.Logger;

@Path("/")
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

    // Return applicants for a given job by joining applications and applicants tables (column names assumed)
    @GET
    @Path("jobs/{jobId}/applicants")
    public Response listApplicantsForJob(@PathParam("jobId") Long jobId){
        List<Map<String,Object>> out = new ArrayList<>();
        if (jobId == null) return Response.ok(out).build();
        EntityManager em = null;
        try {
            em = getEmf().createEntityManager();
            // Expected schema:
            // applications(id, job_id, applicant_id, status, applied_at)
            // applicants(id, name, email, phone, experience_years)
            String sql = "SELECT a.id as application_id, ap.id as applicant_id, ap.name, ap.email, ap.phone, ap.experience_years, a.status, a.applied_at " +
                         "FROM applications a INNER JOIN applicants ap ON ap.id = a.applicant_id WHERE a.job_id = ?1 ORDER BY a.applied_at DESC NULLS LAST, a.id DESC";
            @SuppressWarnings("unchecked")
            List<Object[]> rows = em.createNativeQuery(sql).setParameter(1, jobId).getResultList();
            for(Object[] r : rows){
                Map<String,Object> m = new HashMap<>();
                // map UI fields — use application_id as unique id on the page
                m.put("id", r[0] == null ? null : ((Number)r[0]).longValue());
                m.put("applicantId", r[1] == null ? null : ((Number)r[1]).longValue());
                m.put("name", r[2]);
                m.put("email", r[3]);
                m.put("phone", r[4]);
                Object exp = r[5];
                m.put("experience", exp == null ? null : (exp.toString() + " years"));
                String st = r[6] == null ? "new" : r[6].toString().toLowerCase(Locale.ROOT);
                // normalize common statuses
                if ("under_review".equals(st)) st = "under-review";
                m.put("status", st);
                Object applied = r[7];
                String iso = null;
                if (applied instanceof java.sql.Timestamp ts){
                    iso = ts.toInstant().toString();
                } else if (applied != null){ iso = applied.toString(); }
                m.put("appliedDate", iso);
                out.add(m);
            }
            return Response.ok(out).build();
        } catch(Exception e){
            LOG.severe("Error fetching applicants for job " + jobId + ": " + e.getClass().getName() + ": " + e.getMessage());
            // return empty list so UI can show friendly fallback
            return Response.ok(out).build();
        } finally { if (em != null){ try { em.close(); } catch(Exception ignore){} } }
    }

    // Update application status to accepted
    @POST
    @Path("applicants/{applicantId}/accept")
    public Response accept(@PathParam("applicantId") Long applicantId, @QueryParam("jobId") Long jobId){
        return updateStatus(jobId, applicantId, "accepted");
    }

    // Update application status to rejected
    @POST
    @Path("applicants/{applicantId}/reject")
    public Response reject(@PathParam("applicantId") Long applicantId, @QueryParam("jobId") Long jobId){
        return updateStatus(jobId, applicantId, "rejected");
    }

    private Response updateStatus(Long jobId, Long applicantId, String status){
        if (jobId == null || applicantId == null){
            Map<String,Object> err = Map.of("status","error","reason","Missing jobId or applicantId");
            return Response.status(Response.Status.BAD_REQUEST).entity(err).build();
        }
        EntityManager em = null;
        EntityTransaction tx = null;
        try {
            em = getEmf().createEntityManager();
            tx = em.getTransaction();
            tx.begin();
            // We assume applications.status is a text/varchar domain; map UI dashed to underscore
            String dbStatus = status.replace('-', '_');
            Query q = em.createNativeQuery("UPDATE applications SET status = ?3, updated_at = NOW() WHERE job_id = ?1 AND applicant_id = ?2");
            q.setParameter(1, jobId);
            q.setParameter(2, applicantId);
            q.setParameter(3, dbStatus);
            int updated = q.executeUpdate();
            tx.commit();
            Map<String,Object> ok = new HashMap<>();
            ok.put("status", "ok");
            ok.put("updated", updated);
            return Response.ok(ok).build();
        } catch(Exception e){
            if (tx != null && tx.isActive()) try { tx.rollback(); } catch(Exception ignore){}
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", e.getClass().getName() + ": " + e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(err).build();
        } finally { if (em != null){ try { em.close(); } catch(Exception ignore){} } }
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
