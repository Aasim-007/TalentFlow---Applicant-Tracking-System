package com.example.ats.entity;

public enum JobStatus {
    DRAFT("draft"),
    PUBLISHED("published"),
    CLOSED("closed");

    private final String dbValue;
    JobStatus(String dbValue){ this.dbValue = dbValue; }
    public String getDbValue(){ return dbValue; }
    public static JobStatus fromDb(String v){
        if (v == null) return null;
        for (JobStatus s: values()) if (s.dbValue.equals(v)) return s;
        try { return JobStatus.valueOf(v.toUpperCase()); } catch(Exception ex){ return null; }
    }
}

