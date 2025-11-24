package com.example.ats.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "applications")
public class Application {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "application_ref")
    private String applicationRef;

    @Column(name = "job_id")
    private Long jobId;

    @Column(name = "applicant_user_id")
    private Long applicantUserId;

    @Column(name = "cv_path")
    private String cvPath;

    @Column(name = "cover_letter", length = 4000)
    private String coverLetter;

    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;

    @Column(name = "status")
    private String status;

    @Column(name = "match_score")
    private Double matchScore;

    @Column(name = "red_flags")
    private String redFlags;

    @Column(name = "last_screened_at")
    private OffsetDateTime lastScreenedAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    // getters and setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getApplicationRef() { return applicationRef; }
    public void setApplicationRef(String applicationRef) { this.applicationRef = applicationRef; }

    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }

    public Long getApplicantUserId() { return applicantUserId; }
    public void setApplicantUserId(Long applicantUserId) { this.applicantUserId = applicantUserId; }

    public String getCvPath() { return cvPath; }
    public void setCvPath(String cvPath) { this.cvPath = cvPath; }

    public String getCoverLetter() { return coverLetter; }
    public void setCoverLetter(String coverLetter) { this.coverLetter = coverLetter; }

    public OffsetDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(OffsetDateTime submittedAt) { this.submittedAt = submittedAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Double getMatchScore() { return matchScore; }
    public void setMatchScore(Double matchScore) { this.matchScore = matchScore; }

    public String getRedFlags() { return redFlags; }
    public void setRedFlags(String redFlags) { this.redFlags = redFlags; }

    public OffsetDateTime getLastScreenedAt() { return lastScreenedAt; }
    public void setLastScreenedAt(OffsetDateTime lastScreenedAt) { this.lastScreenedAt = lastScreenedAt; }

    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}

