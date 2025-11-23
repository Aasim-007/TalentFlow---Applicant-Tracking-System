package com.example.ats.service;

import com.example.ats.dto.JobCreateRequest;
import com.example.ats.entity.Job;
import com.example.ats.entity.JobDescription;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.Map;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Lightweight in-memory service for local testing/fallback.
 * Data is NOT persisted to disk and will be lost on restart.
 */
public class InMemoryJobService extends JobService {
    private final AtomicLong idCounter = new AtomicLong(1000);
    private final Map<Long, Job> store = new ConcurrentHashMap<>();

    // Provide a no-arg constructor and override createFromDto
    public InMemoryJobService(){
        super(null); // parent needs an emf but we won't use it
    }

    @Override
    public Job createFromDto(JobCreateRequest req){
        Job job = new Job();
        job.setTitle(req.getJob_title());
        List<JobDescription> jdList = null;
        if(req.getJds() != null){
            jdList = req.getJds().stream()
                    .map(jd -> new JobDescription(jd.getTitle(), jd.getDescription(), jd.getWeight()))
                    .collect(Collectors.toList());
            for (JobDescription jd : jdList) {
                jd.setJob(job);
            }
            job.setJds(jdList);
        }
        long id = idCounter.incrementAndGet();
        job.setId(id); // assign id for client
        store.put(id, job);
        return job;
    }
}
