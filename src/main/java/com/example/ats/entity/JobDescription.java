package com.example.ats.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "job_descriptions")
public class JobDescription {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "section_title")
    private String title;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "weightage")
    private Double weight;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    public JobDescription() {}
    public JobDescription(String title, String description, Double weight){
        this.title = title; this.description = description; this.weight = weight;
    }

    // getters/setters
    public Long getId(){ return id; }
    public String getTitle(){ return title; }
    public void setTitle(String title){ this.title = title; }
    public String getDescription(){ return description; }
    public void setDescription(String description){ this.description = description; }
    public Double getWeight(){ return weight; }
    public void setWeight(Double weight){ this.weight = weight; }
    public Job getJob(){ return job; }
    public void setJob(Job job){ this.job = job; }
}
