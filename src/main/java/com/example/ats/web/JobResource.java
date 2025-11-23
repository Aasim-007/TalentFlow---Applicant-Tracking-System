package com.example.ats.web;

import com.example.ats.dto.JobCreateRequest;
import com.example.ats.entity.Job;
import com.example.ats.service.JobService;
import jakarta.persistence.*;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

import java.util.HashMap;
import java.util.Map;
import java.util.logging.Logger;
import java.util.*;

@Path("/jobs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class JobResource {

    private static final Logger LOG = Logger.getLogger(JobResource.class.getName());

    private JobService jobService;
    private String initError; // non-null if initialization failed
    private static volatile EntityManagerFactory EMF; // cached for read operations

    // Lightweight constructor — defer heavy initialization until first request
    public JobResource() {
        this.jobService = null;
        this.initError = null;
    }

    // Lazily initialize the JobService to avoid blocking server startup (DB may be unreachable)
    private synchronized void initializeServiceIfNeeded(){
        if(this.jobService != null) return;
        JobService svc = null;
        String err = null;

        try {
            var emf = Persistence.createEntityManagerFactory("ATS-PU");
            svc = new JobService(emf);
            LOG.info("JobService initialized successfully (JPA).");
        } catch (Exception e) {
            err = e.getClass().getName() + ": " + e.getMessage();
            LOG.severe("Failed to initialize persistence / JobService: " + err);
            // do not fallback to in-memory; persistence is required for successful responses
         }

         this.jobService = svc;
         this.initError = err;
     }

    private EntityManagerFactory getEmf(){
        EntityManagerFactory local = EMF;
        if (local == null){
            synchronized (JobResource.class){
                local = EMF;
                if (local == null){
                    EMF = local = Persistence.createEntityManagerFactory("ATS-PU");
                }
            }
        }
        return local;
    }

    @POST
    @Path("/create")
    public Response createJob(JobCreateRequest req){
        // Ensure the service is initialized lazily (may fallback to in-memory)
        initializeServiceIfNeeded();

        if (this.jobService == null) {
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Service unavailable: initialization failed");
            err.put("details", this.initError != null ? this.initError : "JobService initialization failed; check server logs for details.");
            return Response.status(Response.Status.SERVICE_UNAVAILABLE).entity(err).build();
        }

        try {
            Job saved = jobService.createFromDto(req);
            Map<String, Object> resp = new HashMap<>();
            resp.put("status", "success");
            resp.put("jobId", saved.getId());
            return Response.ok(resp).build();
        } catch (Exception ex) {
            LOG.severe("Error creating job: " + ex.getMessage());
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Failed to save job");
            err.put("details", ex.getClass().getName() + ": " + ex.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(err).build();
        }
    }

    @GET
    public Response listJobs(@QueryParam("status") String statusParam){
        // Map friendly statuses to DB enum values
        String status = null;
        if (statusParam != null && !statusParam.isBlank()){
            String v = statusParam.trim().toLowerCase(Locale.ROOT);
            if (v.equals("active")) v = "published"; // UI term -> DB enum
            if (v.equals("pending")) v = "draft";    // UI term -> DB enum
            if (v.equals("all")) v = null;
            status = v;
        }

        EntityManager em = null;
        try {
            em = getEmf().createEntityManager();
            String base = "SELECT id, title, department, location, status, created_at FROM jobs";
            boolean filter = (status != null && !status.isBlank());
            String sql = base + (filter ? " WHERE status = CAST(?1 AS job_status)" : "") + " ORDER BY created_at DESC NULLS LAST, id DESC";
            Query q = em.createNativeQuery(sql);
            if (filter) q.setParameter(1, status);
            @SuppressWarnings("unchecked")
            List<Object[]> rows = q.getResultList();
            List<Map<String,Object>> out = new ArrayList<>();
            for(Object[] r: rows){
                Map<String,Object> m = new HashMap<>();
                // columns order: id, title, department, location, status, created_at
                m.put("id", r[0] == null ? null : ((Number)r[0]).longValue());
                m.put("title", r[1]);
                m.put("department", r[2]);
                m.put("location", r[3]);
                String st = r[4] == null ? null : r[4].toString();
                String uiStatus;
                if (st == null) uiStatus = "pending"; // default
                else if ("published".equalsIgnoreCase(st)) uiStatus = "active";
                else if ("draft".equalsIgnoreCase(st)) uiStatus = "pending";
                else if ("closed".equalsIgnoreCase(st)) uiStatus = "closed";
                else uiStatus = st.toLowerCase(Locale.ROOT);
                m.put("status", uiStatus);
                Object created = r[5];
                String isoDate = null;
                if (created instanceof java.sql.Timestamp ts){
                    isoDate = ts.toInstant().toString();
                } else if (created != null){
                    isoDate = created.toString();
                }
                m.put("postedDate", isoDate);
                out.add(m);
            }
            return Response.ok(out).build();
        } catch(Exception e){
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Failed to fetch jobs");
            err.put("details", e.getClass().getName() + ": " + e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(err).build();
        } finally {
            if (em != null){ try { em.close(); } catch(Exception ignore){} }
        }
    }
}