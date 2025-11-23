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
}