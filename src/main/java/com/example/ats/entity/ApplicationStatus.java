package com.example.ats.entity;

public enum ApplicationStatus {
    SUBMITTED("submitted"),
    UNDER_REVIEW("under_review"),
    SHORTLISTED("shortlisted"),
    REJECTED("rejected"),
    INTERVIEW_INVITE("interview_invite"),
    OFFERED("offered"),
    HIRED("hired");

    private final String dbValue;

    ApplicationStatus(String dbValue) {
        this.dbValue = dbValue;
    }

    public String getDbValue() {
        return dbValue;
    }

    public static ApplicationStatus fromDbValue(String dbValue) {
        if (dbValue == null) return null;
        for (ApplicationStatus status : values()) {
            if (status.dbValue.equalsIgnoreCase(dbValue)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown ApplicationStatus: " + dbValue);
    }
}

