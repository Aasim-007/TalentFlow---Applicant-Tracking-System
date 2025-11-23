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

            // Create application
            EntityManager em = emf.createEntityManager();
            try {
                em.getTransaction().begin();

                Application application = new Application();
                application.setApplicationRef(generateApplicationRef());
                application.setJobId(jobId);
                application.setApplicantName(applicantName);
                application.setApplicantEmail(applicantEmail);
                application.setApplicantPhone(applicantPhone);
                application.setCvPath(relativePath);
                application.setCoverLetter(coverLetter);
                application.setSubmittedAt(OffsetDateTime.now());
                application.setStatus(ApplicationStatus.SUBMITTED);
                application.setUpdatedAt(OffsetDateTime.now());

                em.persist(application);
                em.getTransaction().commit();

                LOG.info("Application submitted successfully: " + application.getId());

                resp.setStatus(HttpServletResponse.SC_OK);
                resp.getWriter().write("{\"status\":\"success\",\"applicationRef\":\"" + application.getApplicationRef() + "\"}");

            } catch (Exception e) {
                if (em.getTransaction().isActive()) {
                    em.getTransaction().rollback();
                }
                LOG.severe("Error saving application: " + e.getClass().getName() + ": " + e.getMessage());
                e.printStackTrace();
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
                resp.getWriter().write("{\"status\":\"error\",\"reason\":\"Failed to save application: " + errorMsg.replace("\"", "'") + "\"}");
            } finally {
                em.close();
            }

        } catch (Exception e) {
            LOG.severe("Error processing application: " + e.getClass().getName() + ": " + e.getMessage());
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            String errorMsg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            resp.getWriter().write("{\"status\":\"error\",\"reason\":\"" + errorMsg.replace("\"", "'") + "\"}");
        }
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

