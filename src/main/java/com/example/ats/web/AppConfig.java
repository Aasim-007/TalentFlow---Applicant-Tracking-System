package com.example.ats.web;

import jakarta.ws.rs.core.Application;
import jakarta.ws.rs.ext.ContextResolver;
import jakarta.ws.rs.ext.Provider;
import java.util.Set;
import java.util.HashSet;

import org.glassfish.jersey.jackson.JacksonFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

public class AppConfig extends Application {
    @Override
    public Set<Class<?>> getClasses(){
        Set<Class<?>> s = new HashSet<>();
        s.add(JobResource.class);
        s.add(ManagerResource.class);
        s.add(AuthResource.class);
        s.add(ApplicationResource.class);
        s.add(LoggingFilter.class);
        // register JacksonFeature so Jersey can (de)serialize JSON for Collections/POJOs
        s.add(JacksonFeature.class);
        // register custom ObjectMapper with JSR310 support
        s.add(ObjectMapperContextResolver.class);
        return s;
    }

    /**
     * Custom ObjectMapper resolver that configures Jackson to handle Java 8 date/time types
     */
    @Provider
    public static class ObjectMapperContextResolver implements ContextResolver<ObjectMapper> {
        private final ObjectMapper mapper;

        public ObjectMapperContextResolver() {
            mapper = new ObjectMapper();
            // Register JSR310 module for Java 8 date/time support (OffsetDateTime, LocalDateTime, etc.)
            mapper.registerModule(new JavaTimeModule());
            // Write dates as ISO-8601 strings instead of timestamps
            mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        }

        @Override
        public ObjectMapper getContext(Class<?> type) {
            return mapper;
        }
    }
}