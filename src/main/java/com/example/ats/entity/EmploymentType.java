package com.example.ats.entity;

public enum EmploymentType {
    FULL_TIME("full_time"),
    PART_TIME("part_time"),
    CONTRACT("contract"),
    INTERNSHIP("internship");

    private final String dbValue;
    EmploymentType(String dbValue){ this.dbValue = dbValue; }
    public String getDbValue(){ return dbValue; }
    public static EmploymentType fromDb(String v){
        if (v == null) return null;
        for (EmploymentType e: values()) if (e.dbValue.equals(v)) return e;
        // try matching by name
        try { return EmploymentType.valueOf(v.toUpperCase().replace('-', '_')); } catch(Exception ex){ return null; }
    }
}

