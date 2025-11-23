package com.example.ats.dto;

import java.util.*;
import java.math.BigDecimal;

public class JobCreateRequest {
    private Long JobID; // For update operations
    private String job_title;
    private String department;
    private String location;
    private String employment_type;
    private BigDecimal salary_min;
    private BigDecimal salary_max;
    private String application_deadline; // ISO string
    private String description_summary;
    private String status;
    private Long managed_by_manager_id;

    private List<JD> jds;

    public static class JD {
        public String title;
        public String description;
        public Integer weight;
    }

    // getters & setters
    public Long getJobID(){ return JobID; }
    public void setJobID(Long JobID){ this.JobID = JobID; }

    public String getJob_title(){ return job_title; }
    public void setJob_title(String job_title){ this.job_title = job_title; }

    public String getDepartment(){ return department; }
    public void setDepartment(String department){ this.department = department; }

    public String getLocation(){ return location; }
    public void setLocation(String location){ this.location = location; }

    public String getEmployment_type(){ return employment_type; }
    public void setEmployment_type(String employment_type){ this.employment_type = employment_type; }

    public BigDecimal getSalary_min(){ return salary_min; }
    public void setSalary_min(BigDecimal salary_min){ this.salary_min = salary_min; }

    public BigDecimal getSalary_max(){ return salary_max; }
    public void setSalary_max(BigDecimal salary_max){ this.salary_max = salary_max; }

    public String getApplication_deadline(){ return application_deadline; }
    public void setApplication_deadline(String application_deadline){ this.application_deadline = application_deadline; }

    public String getDescription_summary(){ return description_summary; }
    public void setDescription_summary(String description_summary){ this.description_summary = description_summary; }

    public String getStatus(){ return status; }
    public void setStatus(String status){ this.status = status; }

    public Long getManaged_by_manager_id(){ return managed_by_manager_id; }
    public void setManaged_by_manager_id(Long managed_by_manager_id){ this.managed_by_manager_id = managed_by_manager_id; }

    public List<JD> getJds(){ return jds; }
    public void setJds(List<JD> jds){ this.jds = jds; }
}
