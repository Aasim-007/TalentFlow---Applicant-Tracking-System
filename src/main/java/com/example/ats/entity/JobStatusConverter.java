package com.example.ats.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class JobStatusConverter implements AttributeConverter<JobStatus, String> {
    @Override
    public String convertToDatabaseColumn(JobStatus attribute) {
        return attribute == null ? null : attribute.getDbValue();
    }

    @Override
    public JobStatus convertToEntityAttribute(String dbData) {
        return JobStatus.fromDb(dbData);
    }
}

