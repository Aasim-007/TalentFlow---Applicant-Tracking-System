package com.example.ats.web;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.persistence.*;
import java.io.IOException;
import java.util.UUID;

public class ApplicationSubmitServlet extends HttpServlet {
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        req.setCharacterEncoding("UTF-8");
        String jobIdS = req.getParameter("job_id");
        String name = req.getParameter("name");
        String email = req.getParameter("email");
        String cover = req.getParameter("cover_letter");
        if (jobIdS == null || name == null || email == null){ resp.sendError(HttpServletResponse.SC_BAD_REQUEST); return; }
        Long jobId = Long.valueOf(jobIdS);

        EntityManagerFactory emf = jakarta.persistence.Persistence.createEntityManagerFactory("ATS-PU");
        EntityManager em = emf.createEntityManager();
        EntityTransaction tx = em.getTransaction();
        try {
            tx.begin();
            // find or create user
            Object u = null;
            try {
                u = em.createNativeQuery("SELECT id FROM users WHERE email = ?").setParameter(1, email).getSingleResult();
            } catch(NoResultException n){ u = null; }
            Long userId = null;
            if (u == null){
                // create user and applicant
                Object res = em.createNativeQuery("INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'applicant') RETURNING id")
                        .setParameter(1, email).setParameter(2, UUID.randomUUID().toString()).setParameter(3, name).getSingleResult();
                userId = ((Number)res).longValue();
                em.createNativeQuery("INSERT INTO applicant (user_id, phone) VALUES (?, null)").setParameter(1, userId).executeUpdate();
            } else {
                userId = ((Number)u).longValue();
            }

            // create application with a unique ref
            String appRef = "APP-" + UUID.randomUUID().toString().substring(0,8);
            em.createNativeQuery("INSERT INTO applications (application_ref, job_id, applicant_user_id, cover_letter, status) VALUES (?, ?, ?, ?, 'submitted')")
                    .setParameter(1, appRef).setParameter(2, jobId).setParameter(3, userId).setParameter(4, cover).executeUpdate();
            tx.commit();
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write("{\"status\":\"success\",\"application_ref\":\""+appRef+"\"}");
        } catch(Exception e){ if (tx.isActive()) tx.rollback(); resp.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage()); }
        finally { em.close(); emf.close(); }
    }
}

