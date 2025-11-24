package com.example.ats.web;

import jakarta.ws.rs.core.Application;
import java.util.Set;
import java.util.HashSet;

import org.glassfish.jersey.jackson.JacksonFeature;

public class AppConfig extends Application {
    @Override
    public Set<Class<?>> getClasses(){
        Set<Class<?>> s = new HashSet<>();
        s.add(JobResource.class);
        s.add(ManagerResource.class);
        s.add(AuthResource.class);
        s.add(InterviewResource.class); // expose interview APIs: GET /jobs/{id}/accepted-applicants and POST /api/interviews
        // register JacksonFeature so Jersey can (de)serialize JSON for Collections/POJOs
        s.add(JacksonFeature.class);
        return s;
    }
}