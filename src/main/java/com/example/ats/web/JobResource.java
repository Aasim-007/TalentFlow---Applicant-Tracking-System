package com.example.ats.web;

import com.example.ats.dto.JobCreateRequest;
import com.example.ats.entity.Job;
import com.example.ats.entity.JobDescription;
import com.example.ats.service.JobService;
import jakarta.persistence.Persistence;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import java.util.logging.Logger;

@Path("/jobs")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class JobResource {

    private static final Logger LOG = Logger.getLogger(JobResource.class.getName());

    private JobService jobService;
    private String initError; // non-null if initialization failed

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
            resp.put("formLink", saved.getFormLink());
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

    @POST
    @Path("/update")
    public Response updateJob(JobCreateRequest req){
        initializeServiceIfNeeded();

        if (this.jobService == null) {
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Service unavailable: initialization failed");
            err.put("details", this.initError != null ? this.initError : "JobService initialization failed; check server logs for details.");
            return Response.status(Response.Status.SERVICE_UNAVAILABLE).entity(err).build();
        }

        try {
            Job updated = jobService.updateFromDto(req);
            Map<String, Object> resp = new HashMap<>();
            resp.put("status", "success");
            resp.put("jobId", updated.getId());
            resp.put("formLink", updated.getFormLink());
            return Response.ok(resp).build();
        } catch (Exception ex) {
            LOG.severe("Error updating job: " + ex.getMessage());
            ex.printStackTrace();
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Failed to update job");
            err.put("details", ex.getClass().getName() + ": " + ex.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(err).build();
        }
    }

    @GET
    @Path("/{id}")
    public Response getJobById(@PathParam("id") Long id) {
        initializeServiceIfNeeded();

        if (this.jobService == null) {
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Service unavailable: initialization failed");
            return Response.status(Response.Status.SERVICE_UNAVAILABLE).entity(err).build();
        }

        EntityManager em = null;
        try {
            var emf = Persistence.createEntityManagerFactory("ATS-PU");
            em = emf.createEntityManager();
            Job job = em.find(Job.class, id);

            if (job == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("status", "error");
                error.put("reason", "Job not found");
                return Response.status(Response.Status.NOT_FOUND).entity(error).build();
            }

            // Build response with job details (let frontend decide based on status)
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("id", job.getId());
            response.put("title", job.getTitle());
            response.put("department", job.getDepartment());
            response.put("location", job.getLocation());
            response.put("employmentType", job.getEmploymentType() != null ? job.getEmploymentType().getDbValue() : null);
            response.put("salaryMin", job.getSalaryMin());
            response.put("salaryMax", job.getSalaryMax());
            response.put("applicationDeadline", job.getApplicationDeadline() != null ? job.getApplicationDeadline().toString() : null);
            response.put("status", job.getStatus() != null ? job.getStatus().getDbValue() : null);
            response.put("descriptionSummary", job.getDescriptionSummary());
            response.put("managedByManagerId", job.getManagedByManagerId());

            // Add job descriptions
            List<Map<String, Object>> jdsList = new ArrayList<>();
            for (JobDescription jd : job.getJds()) {
                Map<String, Object> jdMap = new HashMap<>();
                jdMap.put("title", jd.getTitle());
                jdMap.put("description", jd.getDescription());
                jdMap.put("weightage", jd.getWeight());
                jdsList.add(jdMap);
            }
            response.put("jobDescriptions", jdsList);

            return Response.ok(response).build();

        } catch (Exception e) {
            LOG.severe("Error fetching job: " + e.getMessage());
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("status", "error");
            error.put("reason", "Internal server error");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(error).build();
        } finally {
            if (em != null) {
                try {
                    em.close();
                } catch (Exception ignore) {
                }
            }
        }
    }
}