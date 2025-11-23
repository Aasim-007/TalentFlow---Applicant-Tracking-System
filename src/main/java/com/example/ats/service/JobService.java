package com.example.ats.service;

import com.example.ats.dto.JobCreateRequest;
import com.example.ats.entity.*;
import com.example.ats.repository.JobRepository;
import jakarta.persistence.EntityManagerFactory;
import java.util.stream.Collectors;
import java.util.List;

public class JobService {
    private final JobRepository jobRepo;

    public JobService(EntityManagerFactory emf){
        this.jobRepo = new JobRepository(emf);
    }

    public Job createFromDto(JobCreateRequest req){
        Job job = new Job();
        job.setTitle(req.getJob_title());
        job.setDepartment(req.getDepartment());
        job.setLocation(req.getLocation());
        // convert employment type to enum
        if (req.getEmployment_type() != null) job.setEmploymentType(com.example.ats.entity.EmploymentType.fromDb(req.getEmployment_type()));
        job.setSalaryMin(req.getSalary_min());
        job.setSalaryMax(req.getSalary_max());
        if (req.getApplication_deadline() != null){
            job.setApplicationDeadline(java.time.OffsetDateTime.parse(req.getApplication_deadline()));
        }
        job.setDescriptionSummary(req.getDescription_summary());
        if (req.getStatus() != null) job.setStatus(com.example.ats.entity.JobStatus.fromDb(req.getStatus()));
        job.setManagedByManagerId(req.getManaged_by_manager_id());
        job.setCreatedAt(java.time.OffsetDateTime.now());
        job.setUpdatedAt(java.time.OffsetDateTime.now());
        List<JobDescription> jdList = null;
        if(req.getJds() != null){
            jdList = req.getJds().stream()
                    .map(jd -> new JobDescription(jd.getTitle(), jd.getDescription(), jd.getWeight()))
                    .collect(Collectors.toList());
            // attach to job with back-reference
            for (JobDescription jd : jdList){ jd.setJob(job); }
            job.setJds(jdList);
        }

        // obtain a unique id before persisting
        Long id = jobRepo.nextId();
        job.setId(id);

        // Generate form link to application page
        job.setFormLink("/apply/apply.html?jobId=" + id);

        return jobRepo.save(job);
    }

    public Job updateFromDto(JobCreateRequest req){
        // Get JobID from request
        Long jobId = req.getJobID();
        System.out.println("=== JobService.updateFromDto ===");
        System.out.println("JobID from request: " + jobId);

        if (jobId == null) {
            System.err.println("ERROR: JobID is null!");
            throw new IllegalArgumentException("JobID is required for update");
        }

        // Fetch existing job
        System.out.println("Fetching job with ID: " + jobId);
        Job job = jobRepo.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found with ID: " + jobId));

        System.out.println("Found existing job: " + job.getTitle());

        // Update job fields
        job.setTitle(req.getJob_title());
        job.setDepartment(req.getDepartment());
        job.setLocation(req.getLocation());
        if (req.getEmployment_type() != null) {
            job.setEmploymentType(com.example.ats.entity.EmploymentType.fromDb(req.getEmployment_type()));
        }
        job.setSalaryMin(req.getSalary_min());
        job.setSalaryMax(req.getSalary_max());
        if (req.getApplication_deadline() != null){
            job.setApplicationDeadline(java.time.OffsetDateTime.parse(req.getApplication_deadline()));
        }
        job.setDescriptionSummary(req.getDescription_summary());
        if (req.getStatus() != null) {
            job.setStatus(com.example.ats.entity.JobStatus.fromDb(req.getStatus()));
        }
        job.setManagedByManagerId(req.getManaged_by_manager_id());
        job.setUpdatedAt(java.time.OffsetDateTime.now());

        System.out.println("Updated job fields, now clearing JDs...");

        // Delete existing JDs and add new ones
        job.getJds().clear();

        if(req.getJds() != null){
            System.out.println("Adding " + req.getJds().size() + " new JDs");
            List<JobDescription> jdList = req.getJds().stream()
                    .map(jd -> new JobDescription(jd.getTitle(), jd.getDescription(), jd.getWeight()))
                    .collect(Collectors.toList());
            // attach to job with back-reference
            for (JobDescription jd : jdList){
                jd.setJob(job);
                job.getJds().add(jd);
            }
        }

        System.out.println("Calling jobRepo.update()...");
        Job result = jobRepo.update(job);
        System.out.println("Update completed successfully!");
        return result;
    }
}
