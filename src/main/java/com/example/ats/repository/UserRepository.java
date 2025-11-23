package com.example.ats.repository;

import jakarta.persistence.*;
import java.util.*;

public class UserRepository {
    private final EntityManagerFactory emf;
    public UserRepository(EntityManagerFactory emf){ this.emf = emf; }

    public Optional<UserRow> findUserByEmail(String email){
        try (EntityManager em = emf.createEntityManager()){
            String sql = "SELECT id, email, password_hash, name, role FROM users WHERE email = ?1";
            Query q = em.createNativeQuery(sql);
            q.setParameter(1, email);
            @SuppressWarnings("unchecked")
            var rows = q.getResultList();
            if (rows.isEmpty()) return Optional.empty();
            Object[] r = (Object[]) rows.get(0);
            UserRow u = new UserRow();
            u.id = ((Number)r[0]).longValue();
            u.email = (String) r[1];
            u.password = (String) r[2];
            u.name = (String) r[3];
            u.role = r[4] == null ? null : r[4].toString();
            return Optional.of(u);
        }
    }

    public long createUserAndRole(String name, String email, String plainPassword, String role,
                                  String employeeNumber, String hrDepartment,
                                  String managerCode, String team,
                                  String phone, String resumeText, String linkedinUrl){
        EntityManager em = emf.createEntityManager();
        EntityTransaction tx = em.getTransaction();
        try {
            tx.begin();
            String insUser = "INSERT INTO users (email, password_hash, name, role) VALUES (?1, ?2, ?3, CAST(?4 AS user_role)) RETURNING id";
            Object idObj = em.createNativeQuery(insUser)
                    .setParameter(1, email)
                    .setParameter(2, plainPassword)
                    .setParameter(3, name)
                    .setParameter(4, role)
                    .getSingleResult();
            long userId = ((Number) idObj).longValue();

            switch (role){
                case "hr": {
                    String sql = "INSERT INTO hr (user_id, employee_number, department) VALUES (?1, ?2, ?3)";
                    em.createNativeQuery(sql)
                            .setParameter(1, userId)
                            .setParameter(2, employeeNumber)
                            .setParameter(3, hrDepartment)
                            .executeUpdate();
                    break;
                }
                case "hiring_manager": {
                    String sql = "INSERT INTO hiring_manager (user_id, manager_code, team) VALUES (?1, ?2, ?3)";
                    em.createNativeQuery(sql)
                            .setParameter(1, userId)
                            .setParameter(2, managerCode)
                            .setParameter(3, team)
                            .executeUpdate();
                    break;
                }
                case "applicant": {
                    String sql = "INSERT INTO applicant (user_id, phone, resume_text, linkedin_url) VALUES (?1, ?2, ?3, ?4)";
                    em.createNativeQuery(sql)
                            .setParameter(1, userId)
                            .setParameter(2, phone)
                            .setParameter(3, resumeText)
                            .setParameter(4, linkedinUrl)
                            .executeUpdate();
                    break;
                }
                case "admin":
                default:
                    // no specific table
                    break;
            }
            tx.commit();
            return userId;
        } catch(Exception e){
            if (tx.isActive()) tx.rollback();
            throw e;
        } finally {
            em.close();
        }
    }

    public static class UserRow { public long id; public String email; public String password; public String name; public String role; }
}
