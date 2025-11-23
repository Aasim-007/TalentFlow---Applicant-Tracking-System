package com.example.ats.web;

import com.example.ats.entity.*;
import jakarta.persistence.*;
import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.MultipartConfig;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;
import java.io.*;
import java.nio.file.*;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.logging.Logger;

@WebServlet("/api/applications/submit")
@MultipartConfig(
    fileSizeThreshold = 1024 * 1024 * 2,  // 2MB
    maxFileSize = 1024 * 1024 * 10,       // 10MB
    maxRequestSize = 1024 * 1024 * 50     // 50MB
)
public class ApplicationSubmitServlet extends HttpServlet {
    private static final Logger LOG = Logger.getLogger(ApplicationSubmitServlet.class.getName());
    private static final String UPLOAD_DIR = "uploads/cvs";
    private EntityManagerFactory emf;

    @Override
    public void init() throws ServletException {
        super.init();
        try {
            Map<String, String> overrides = new HashMap<>();
            String envUrl = System.getenv("DB_URL");
            String envUser = System.getenv("DB_USER");
            String envPass = System.getenv("DB_PASSWORD");
            String envSsl = System.getenv("DB_SSLMODE");

            if (envUrl != null && !envUrl.isBlank()) overrides.put("jakarta.persistence.jdbc.url", envUrl);
            if (envUser != null && !envUser.isBlank()) overrides.put("jakarta.persistence.jdbc.user", envUser);
            if (envPass != null && !envPass.isBlank()) overrides.put("jakarta.persistence.jdbc.password", envPass);
            if (envSsl != null && !envSsl.isBlank()) {
                if (overrides.containsKey("jakarta.persistence.jdbc.url") && !overrides.get("jakarta.persistence.jdbc.url").contains("sslmode=")) {
                    String u = overrides.get("jakarta.persistence.jdbc.url");
                    String sep = u.contains("?") ? "&" : "?";
                    overrides.put("jakarta.persistence.jdbc.url", u + sep + "sslmode=" + envSsl);
                }
            }

            emf = Persistence.createEntityManagerFactory("ATS-PU", overrides);
            LOG.info("ApplicationSubmitServlet initialized successfully");
        } catch (Exception e) {
            LOG.severe("Failed to initialize EMF: " + e.getMessage());
            throw new ServletException("Persistence initialization failed", e);
        }
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");

        try {
            // Extract form data
            String jobIdStr = req.getParameter("jobId");
            String applicantName = req.getParameter("applicantName");
            String applicantEmail = req.getParameter("applicantEmail");
            String applicantPhone = req.getParameter("applicantPhone");
            String coverLetter = req.getParameter("coverLetter");
            Part cvPart = req.getPart("cv");

            // Validate required fields
            if (jobIdStr == null || applicantName == null || applicantEmail == null || cvPart == null) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("{\"status\":\"error\",\"reason\":\"Missing required fields\"}");
                return;
            }

            Long jobId = Long.parseLong(jobIdStr);

            // Create upload directory if not exists
            String uploadPath = getServletContext().getRealPath("") + File.separator + UPLOAD_DIR;
            File uploadDir = new File(uploadPath);
            if (!uploadDir.exists()) {
                uploadDir.mkdirs();
            }

            // Save CV file
            String fileName = generateUniqueFileName(cvPart.getSubmittedFileName());
            String filePath = uploadPath + File.separator + fileName;
            cvPart.write(filePath);
            String relativePath = UPLOAD_DIR + "/" + fileName;

            // Sanitize cover letter (remove control characters that break JSON)
            String sanitizedCoverLetter = sanitizeForJson(coverLetter);

            EntityManager em = emf.createEntityManager();
            try {
                em.getTransaction().begin();

                // Step 1: Check if user already exists by email
                Long applicantUserId = null;
                try {
                    applicantUserId = (Long) em.createNativeQuery(
                        "SELECT id FROM users WHERE email = ? AND role = CAST(? AS user_role)")
                        .setParameter(1, applicantEmail)
                        .setParameter(2, "applicant")
                        .getSingleResult();
                    LOG.info("Found existing applicant user: " + applicantUserId);
                } catch (NoResultException e) {
                    // User doesn't exist, create new one
                    LOG.info("Creating new applicant user for: " + applicantEmail);

                    // Insert into users table
                    em.createNativeQuery(
                        "INSERT INTO users (email, password_hash, name, role, created_at, updated_at) " +
                        "VALUES (?, ?, ?, CAST(? AS user_role), ?, ?)")
                        .setParameter(1, applicantEmail)
                        .setParameter(2, "temp_hash_" + UUID.randomUUID().toString()) // Temporary password hash
                        .setParameter(3, applicantName)
                        .setParameter(4, "applicant")
                        .setParameter(5, java.sql.Timestamp.from(OffsetDateTime.now().toInstant()))
                        .setParameter(6, java.sql.Timestamp.from(OffsetDateTime.now().toInstant()))
                        .executeUpdate();

                    // Get the generated user ID
                    applicantUserId = (Long) em.createNativeQuery("SELECT lastval()").getSingleResult();
                    LOG.info("Created user with ID: " + applicantUserId);

                    // Insert into applicant table
                    em.createNativeQuery(
                        "INSERT INTO applicant (user_id, phone, linkedin_url) VALUES (?, ?, ?)")
                        .setParameter(1, applicantUserId)
                        .setParameter(2, applicantPhone)
                        .setParameter(3, null) // LinkedIn URL can be added later
                        .executeUpdate();
                    LOG.info("Created applicant record for user: " + applicantUserId);
                }

                // Step 2: Create application with all required fields
                String applicationRef = generateApplicationRef();
                em.createNativeQuery(
                    "INSERT INTO applications (application_ref, job_id, applicant_user_id, applicant_name, applicant_email, applicant_phone, cv_path, cover_letter, submitted_at, status, updated_at) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS application_status), ?)")
                    .setParameter(1, applicationRef)
                    .setParameter(2, jobId)
                    .setParameter(3, applicantUserId)
                    .setParameter(4, applicantName)
                    .setParameter(5, applicantEmail)
                    .setParameter(6, applicantPhone)
                    .setParameter(7, relativePath)
                    .setParameter(8, sanitizedCoverLetter)
                    .setParameter(9, java.sql.Timestamp.from(OffsetDateTime.now().toInstant()))
                    .setParameter(10, "submitted")
                    .setParameter(11, java.sql.Timestamp.from(OffsetDateTime.now().toInstant()))
                    .executeUpdate();

                em.getTransaction().commit();

                LOG.info("Application submitted successfully with ref: " + applicationRef);

                resp.setStatus(HttpServletResponse.SC_OK);
                resp.getWriter().write("{\"status\":\"success\",\"applicationRef\":\"" + applicationRef + "\"}");

            } catch (Exception e) {
                if (em.getTransaction().isActive()) {
                    em.getTransaction().rollback();
                }
                LOG.severe("Error saving application: " + e.getClass().getName() + ": " + e.getMessage());
                e.printStackTrace();
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                resp.getWriter().write(escapeJson("Failed to save application: " + errorMsg));
            } finally {
                em.close();
            }

        } catch (Exception e) {
            LOG.severe("Error processing application: " + e.getClass().getName() + ": " + e.getMessage());
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            resp.getWriter().write(escapeJson(errorMsg));
        }
    }

    private String sanitizeForJson(String input) {
        if (input == null) return null;
        // Remove or escape control characters that break JSON
        return input.replaceAll("[\\x00-\\x1F\\x7F]", " ").trim();
    }

    private String escapeJson(String message) {
        if (message == null) return "{\"status\":\"error\",\"reason\":\"Unknown error\"}";
        // Properly escape for JSON
        String escaped = message
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t");
        return "{\"status\":\"error\",\"reason\":\"" + escaped + "\"}";
    }

    private String generateUniqueFileName(String originalFileName) {
        String extension = "";
        int dotIndex = originalFileName.lastIndexOf('.');
        if (dotIndex > 0) {
            extension = originalFileName.substring(dotIndex);
        }
        return System.currentTimeMillis() + "_" + UUID.randomUUID().toString() + extension;
    }

    private String generateApplicationRef() {
        return "APP-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    @Override
    public void destroy() {
        if (emf != null && emf.isOpen()) {
            emf.close();
        }
        super.destroy();
    }
}

