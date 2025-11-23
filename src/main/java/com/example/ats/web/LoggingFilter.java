package com.example.ats.web;

import jakarta.ws.rs.container.*;
import jakarta.ws.rs.ext.Provider;
import java.io.*;
import java.util.logging.Logger;

@Provider
public class LoggingFilter implements ContainerRequestFilter {
    private static final Logger LOG = Logger.getLogger(LoggingFilter.class.getName());

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        LOG.info("=== INCOMING REQUEST ===");
        LOG.info("Method: " + requestContext.getMethod());
        LOG.info("Path: " + requestContext.getUriInfo().getPath());
        LOG.info("Content-Type: " + requestContext.getHeaderString("Content-Type"));

        if (requestContext.hasEntity() && "POST".equals(requestContext.getMethod())) {
            // Read the entity stream
            InputStream entityStream = requestContext.getEntityStream();
            String body = new BufferedReader(new InputStreamReader(entityStream))
                    .lines()
                    .reduce("", (accumulator, actual) -> accumulator + actual);

            LOG.info("Request Body: " + body);

            // Reset the stream for Jersey to read
            requestContext.setEntityStream(new ByteArrayInputStream(body.getBytes()));
        }
        LOG.info("======================");
    }
}

