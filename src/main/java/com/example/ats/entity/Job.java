package com.example.ats.entity;

import jakarta.persistence.*;
import java.util.*;

@Entity
@Table(name = "jobs")
public class Job {
    @Id
    private Long id;

    @Column(name = "title", nullable=false)
    private String title;

    @Column(name = "department")
    private String department;

    @Column(name = "location")
    private String location;

    @Column(name = "employment_type", columnDefinition = "employment_type")
    private EmploymentType employmentType;

    @Column(name = "salary_min")
    private java.math.BigDecimal salaryMin;

    @Column(name = "salary_max")
    private java.math.BigDecimal salaryMax;

    @Column(name = "application_deadline")
    private java.time.OffsetDateTime applicationDeadline;

    @Column(name = "status", columnDefinition = "job_status")
    private JobStatus status;

    @Column(name = "description_summary", columnDefinition = "text")
    private String descriptionSummary;

    @Column(name = "managed_by_manager_id")
    private Long managedByManagerId;

    @Column(name = "created_at")
    private java.time.OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private java.time.OffsetDateTime updatedAt;

    @Column(name = "form_link")
    private String formLink;

    @OneToMany(mappedBy = "job", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<JobDescription> jds = new ArrayList<>();

    // constructors, getters, setters
    public Job(){}
    public Job(String title){ this.title = title; }

    public Long getId(){ return id; }
    public void setId(Long id){ this.id = id; } // we will assign id from DB sequence before persisting

    // Title accessor/mutator used by services and DTO mapping
    public String getTitle(){ return title; }
    public void setTitle(String title){ this.title = title; }

    public List<JobDescription> getJds(){ return jds; }
    public void setJds(List<JobDescription> jds){ this.jds = jds; }

    // getters/setters for new fields
    public String getDepartment(){ return department; }
    public void setDepartment(String department){ this.department = department; }

    public String getLocation(){ return location; }
    public void setLocation(String location){ this.location = location; }

    public EmploymentType getEmploymentType(){ return employmentType; }
    public void setEmploymentType(EmploymentType employmentType){ this.employmentType = employmentType; }

    public java.math.BigDecimal getSalaryMin(){ return salaryMin; }
    public void setSalaryMin(java.math.BigDecimal salaryMin){ this.salaryMin = salaryMin; }

    public java.math.BigDecimal getSalaryMax(){ return salaryMax; }
    public void setSalaryMax(java.math.BigDecimal salaryMax){ this.salaryMax = salaryMax; }

    public java.time.OffsetDateTime getApplicationDeadline(){ return applicationDeadline; }
    public void setApplicationDeadline(java.time.OffsetDateTime applicationDeadline){ this.applicationDeadline = applicationDeadline; }

    public JobStatus getStatus(){ return status; }
    public void setStatus(JobStatus status){ this.status = status; }

    public String getDescriptionSummary(){ return descriptionSummary; }
    public void setDescriptionSummary(String descriptionSummary){ this.descriptionSummary = descriptionSummary; }

    public Long getManagedByManagerId(){ return managedByManagerId; }
    public void setManagedByManagerId(Long managedByManagerId){ this.managedByManagerId = managedByManagerId; }

    public java.time.OffsetDateTime getCreatedAt(){ return createdAt; }
    public void setCreatedAt(java.time.OffsetDateTime createdAt){ this.createdAt = createdAt; }

    public java.time.OffsetDateTime getUpdatedAt(){ return updatedAt; }
    public void setUpdatedAt(java.time.OffsetDateTime updatedAt){ this.updatedAt = updatedAt; }

    public String getFormLink(){ return formLink; }
    public void setFormLink(String formLink){ this.formLink = formLink; }

    // Helper methods for setting from strings (used in REST endpoints)
    public void setEmploymentTypeFromString(String typeStr) {
        if (typeStr != null && !typeStr.isEmpty()) {
            this.employmentType = EmploymentType.fromDb(typeStr);
        }
    }

    public void setStatusFromString(String statusStr) {
        if (statusStr != null && !statusStr.isEmpty()) {
            this.status = JobStatus.fromDb(statusStr);
        }
    }

    public void setApplicationDeadlineFromString(String dateStr) {
        if (dateStr != null && !dateStr.isEmpty()) {
            this.applicationDeadline = java.time.OffsetDateTime.parse(dateStr);
        }
    }

    public void setSalaryMin(Double value) {
        this.salaryMin = value != null ? java.math.BigDecimal.valueOf(value) : null;
    }

    public void setSalaryMax(Double value) {
        this.salaryMax = value != null ? java.math.BigDecimal.valueOf(value) : null;
    }
}
