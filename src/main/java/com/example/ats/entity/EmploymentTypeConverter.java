package com.example.ats.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class EmploymentTypeConverter implements AttributeConverter<EmploymentType, String> {
    @Override
    public String convertToDatabaseColumn(EmploymentType attribute) {
        return attribute == null ? null : attribute.getDbValue();
    }

    @Override
    public EmploymentType convertToEntityAttribute(String dbData) {
        return EmploymentType.fromDb(dbData);
    }
}

