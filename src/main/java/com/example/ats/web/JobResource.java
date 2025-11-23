package com.example.ats.web;

import com.example.ats.dto.JobCreateRequest;
import com.example.ats.entity.Job;
import com.example.ats.service.JobService;
import jakarta.persistence.Persistence;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;

import java.util.HashMap;
import java.util.Map;
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
    @Path("/{id}")
    public Response getJobById(@PathParam("id") Long id){
        initializeServiceIfNeeded();

        if (this.jobService == null) {
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Service unavailable: initialization failed");
            err.put("details", this.initError != null ? this.initError : "JobService initialization failed");
            return Response.status(Response.Status.SERVICE_UNAVAILABLE).entity(err).build();
        }

        try {
            Job job = jobService.findById(id);
            if (job == null) {
                Map<String,Object> err = new HashMap<>();
                err.put("status", "error");
                err.put("reason", "Job not found");
                return Response.status(Response.Status.NOT_FOUND).entity(err).build();
            }

            // Check if job is published/closed - return 410 Gone for apply page
            // For edit page, we'll return 403 if not draft
            String status = job.getStatus() != null ? job.getStatus().name().toLowerCase() : "draft";

            // Convert to DTO/Map for JSON response
            Map<String, Object> jobData = new HashMap<>();
            jobData.put("id", job.getId());
            jobData.put("title", job.getTitle());
            jobData.put("department", job.getDepartment());
            jobData.put("location", job.getLocation());
            jobData.put("employmentType", job.getEmploymentType() != null ? job.getEmploymentType().name() : null);
            jobData.put("salaryMin", job.getSalaryMin());
            jobData.put("salaryMax", job.getSalaryMax());
            jobData.put("applicationDeadline", job.getApplicationDeadline());
            jobData.put("status", status);
            jobData.put("formLink", job.getFormLink());
            jobData.put("descriptionSummary", job.getDescriptionSummary());
            jobData.put("managedByManagerId", job.getManagedByManagerId());

            // Include job descriptions
            var jds = job.getJds();
            if (jds != null && !jds.isEmpty()) {
                var jdList = jds.stream().map(jd -> {
                    Map<String, Object> jdMap = new HashMap<>();
                    jdMap.put("title", jd.getTitle());
                    jdMap.put("description", jd.getDescription());
                    jdMap.put("weightage", jd.getWeight());
                    return jdMap;
                }).toList();
                jobData.put("jobDescriptions", jdList);
            }

            return Response.ok(jobData).build();

        } catch (Exception ex) {
            LOG.severe("Error fetching job: " + ex.getMessage());
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Failed to fetch job");
            err.put("details", ex.getClass().getName() + ": " + ex.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(err).build();
        }
    }

    @GET
    public Response getAllJobs(){
        initializeServiceIfNeeded();

        if (this.jobService == null) {
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Service unavailable: initialization failed");
            return Response.status(Response.Status.SERVICE_UNAVAILABLE).entity(err).build();
        }

        try {
            var jobs = jobService.findAll();
            var jobList = jobs.stream().map(job -> {
                Map<String, Object> jobData = new HashMap<>();
                jobData.put("id", job.getId());
                jobData.put("title", job.getTitle());
                jobData.put("department", job.getDepartment());
                jobData.put("location", job.getLocation());
                jobData.put("employmentType", job.getEmploymentType() != null ? job.getEmploymentType().name() : null);
                jobData.put("salaryMin", job.getSalaryMin());
                jobData.put("salaryMax", job.getSalaryMax());
                jobData.put("applicationDeadline", job.getApplicationDeadline());
                jobData.put("status", job.getStatus() != null ? job.getStatus().name().toLowerCase() : "draft");
                jobData.put("formLink", job.getFormLink());
                return jobData;
            }).toList();

            return Response.ok(jobList).build();

        } catch (Exception ex) {
            LOG.severe("Error fetching jobs: " + ex.getMessage());
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Failed to fetch jobs");
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(err).build();
        }
    }

    @POST
    @Path("/update")
    public Response updateJob(Map<String, Object> requestData){
        initializeServiceIfNeeded();

        if (this.jobService == null) {
            Map<String,Object> err = new HashMap<>();
            err.put("status", "error");
            err.put("reason", "Service unavailable: initialization failed");
            return Response.status(Response.Status.SERVICE_UNAVAILABLE).entity(err).build();
        }

        try {
            Object jobIdObj = requestData.get("JobID");
            if (jobIdObj == null) {
                jobIdObj = requestData.get("jobId");
            }

            if (jobIdObj == null) {
                Map<String,Object> err = new HashMap<>();
                err.put("status", "error");
                err.put("reason", "Missing JobID in request");
                return Response.status(Response.Status.BAD_REQUEST).entity(err).build();
            }

            Long jobId = jobIdObj instanceof Number ? ((Number) jobIdObj).longValue() : Long.parseLong(jobIdObj.toString());

            Job job = jobService.findById(jobId);
            if (job == null) {
                Map<String,Object> err = new HashMap<>();
                err.put("status", "error");
                err.put("reason", "Job not found");
                return Response.status(Response.Status.NOT_FOUND).entity(err).build();
            }

            // Update job fields
            if (requestData.containsKey("job_title")) {
                job.setTitle((String) requestData.get("job_title"));
            }
            if (requestData.containsKey("department")) {
                job.setDepartment((String) requestData.get("department"));
            }
            if (requestData.containsKey("location")) {
                job.setLocation((String) requestData.get("location"));
            }
            if (requestData.containsKey("employment_type")) {
                job.setEmploymentTypeFromString((String) requestData.get("employment_type"));
            }
            if (requestData.containsKey("salary_min")) {
                Object salMin = requestData.get("salary_min");
                job.setSalaryMin(salMin instanceof Number ? ((Number) salMin).doubleValue() : null);
            }
            if (requestData.containsKey("salary_max")) {
                Object salMax = requestData.get("salary_max");
                job.setSalaryMax(salMax instanceof Number ? ((Number) salMax).doubleValue() : null);
            }
            if (requestData.containsKey("application_deadline")) {
                // Parse date string if needed
                Object deadline = requestData.get("application_deadline");
                if (deadline instanceof String) {
                    job.setApplicationDeadlineFromString((String) deadline);
                }
            }
            if (requestData.containsKey("description_summary")) {
                job.setDescriptionSummary((String) requestData.get("description_summary"));
            }
            if (requestData.containsKey("status")) {
                job.setStatusFromString((String) requestData.get("status"));
            }
            if (requestData.containsKey("managed_by_manager_id")) {
                Object managerId = requestData.get("managed_by_manager_id");
                job.setManagedByManagerId(managerId instanceof Number ? ((Number) managerId).longValue() : null);
            }

            // Handle JDs
            if (requestData.containsKey("jds")) {
                var jdsList = (java.util.List<?>) requestData.get("jds");
                jobService.updateJobDescriptions(job, jdsList);
            }

            jobService.update(job);

            Map<String, Object> resp = new HashMap<>();
            resp.put("status", "success");
            resp.put("jobId", job.getId());
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
}