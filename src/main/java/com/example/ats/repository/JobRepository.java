package com.example.ats.repository;

import com.example.ats.entity.*;
import jakarta.persistence.*;
import java.util.*;

public class JobRepository {
    private final EntityManagerFactory emf;

    public JobRepository(EntityManagerFactory emf){
        this.emf = emf;
    }

    public Job save(Job job){
        try (EntityManager em = emf.createEntityManager()) {
            EntityTransaction tx = em.getTransaction();
            try {
                tx.begin();

                // Native insert into jobs with explicit enum casts to avoid JDBC varchar->enum issues
                String insertJob = "INSERT INTO jobs (id, title, department, location, employment_type, salary_min, salary_max, application_deadline, status, form_link, description_summary, created_at, updated_at) VALUES (?, ?, ?, ?, CAST(? AS employment_type), ?, ?, ?, CAST(? AS job_status), ?, ?, ?, ?)";
                Query q = em.createNativeQuery(insertJob);
                int idx = 1;
                q.setParameter(idx++, job.getId());
                q.setParameter(idx++, job.getTitle());
                q.setParameter(idx++, job.getDepartment());
                q.setParameter(idx++, job.getLocation());
                q.setParameter(idx++, job.getEmploymentType() == null ? null : job.getEmploymentType().getDbValue());
                q.setParameter(idx++, job.getSalaryMin());
                q.setParameter(idx++, job.getSalaryMax());
                q.setParameter(idx++, job.getApplicationDeadline() == null ? null : java.sql.Timestamp.from(job.getApplicationDeadline().toInstant()));
                q.setParameter(idx++, job.getStatus() == null ? null : job.getStatus().getDbValue());
                q.setParameter(idx++, job.getFormLink());
                q.setParameter(idx++, job.getDescriptionSummary());
                q.setParameter(idx++, job.getCreatedAt() == null ? java.sql.Timestamp.from(java.time.OffsetDateTime.now().toInstant()) : java.sql.Timestamp.from(job.getCreatedAt().toInstant()));
                q.setParameter(idx++, job.getUpdatedAt() == null ? java.sql.Timestamp.from(java.time.OffsetDateTime.now().toInstant()) : java.sql.Timestamp.from(job.getUpdatedAt().toInstant()));
                q.executeUpdate();

                // Insert job_descriptions
                if (job.getJds() != null) {
                    for (JobDescription jd : job.getJds()){
                        if (jd.getJob() == null) jd.setJob(job);
                        String ins = "INSERT INTO job_descriptions (job_id, section_title, description, weightage, created_at) VALUES (?, ?, ?, ?, ?)";
                        Query qj = em.createNativeQuery(ins);
                        qj.setParameter(1, job.getId());
                        qj.setParameter(2, jd.getTitle());
                        qj.setParameter(3, jd.getDescription());
                        qj.setParameter(4, jd.getWeight());
                        qj.setParameter(5, java.sql.Timestamp.from(java.time.OffsetDateTime.now().toInstant()));
                        qj.executeUpdate();
                    }
                }

                tx.commit();
                return job;
            } catch(Exception e){
                if(tx.isActive()) tx.rollback();
                throw e;
            }
        }
    }

    // Attempt to retrieve next id from a DB sequence 'jobs_id_seq'. If sequence not found, fallback to max(id)+1.
    public Long nextId(){
        try (EntityManager em = emf.createEntityManager()) {
            try {
                // try sequence first (Postgres)
                Object o = em.createNativeQuery("SELECT nextval('jobs_id_seq')").getSingleResult();
                if (o instanceof Number) return ((Number)o).longValue();
                return Long.valueOf(o.toString());
            } catch (PersistenceException pe){
                // sequence not found or error: fallback to max(id)+1
                Number max = (Number) em.createQuery("SELECT COALESCE(MAX(j.id), 0) FROM Job j").getSingleResult();
                return (max == null ? 1L : max.longValue() + 1L);
            }
        }
    }

    public Optional<Job> findById(Long id){
        try (EntityManager em = emf.createEntityManager()) {
            return Optional.ofNullable(em.find(Job.class, id));
        }
    }
}