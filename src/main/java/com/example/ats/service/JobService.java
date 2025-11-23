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
                    .map(jd -> new JobDescription(jd.title, jd.description, jd.weight))
                    .collect(Collectors.toList());
            // attach to job with back-reference
            for (JobDescription jd : jdList){ jd.setJob(job); }
            job.setJds(jdList);
        }

        // obtain a unique id before persisting
        Long id = jobRepo.nextId();
        job.setId(id);

        // generate form link: /form/<id>-<slugified-title>
        String slug = req.getJob_title() == null ? "job" : req.getJob_title().toLowerCase().replaceAll("[^a-z0-9]+","-").replaceAll("(^-|-$)","");
        job.setFormLink("/form/" + id + "-" + slug);

        return jobRepo.save(job);
    }
}
