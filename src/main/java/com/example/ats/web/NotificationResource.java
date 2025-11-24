package com.example.ats.web;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.Persistence;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;

@Path("/notifications")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class NotificationResource {

    private static final Logger LOG = Logger.getLogger(NotificationResource.class.getName());
    private static EntityManagerFactory emf;

    private EntityManagerFactory getEmf() {
        if (emf == null) {
            synchronized (NotificationResource.class) {
                if (emf == null) {
                    emf = Persistence.createEntityManagerFactory("ATS-PU");
                }
            }
        }
        return emf;
    }

    /**
     * Get all notifications for a specific application
     * GET /api/notifications/application/{applicationId}
     */
    @GET
    @Path("/application/{applicationId}")
    public Response getNotificationsByApplication(@PathParam("applicationId") Long applicationId) {
        EntityManager em = null;
        try {
            em = getEmf().createEntityManager();

            // Query to get all notifications for this application
            String sql = "SELECT id, application_id, notification_type, to_email, subject, body, sent_at, created_by_user_id " +
                        "FROM notifications WHERE application_id = ? ORDER BY sent_at DESC";

            List<Object[]> results = em.createNativeQuery(sql)
                    .setParameter(1, applicationId)
                    .getResultList();

            // Convert to JSON-friendly format
            var notifications = results.stream().map(row -> {
                Map<String, Object> notification = new HashMap<>();
                notification.put("id", row[0]);
                notification.put("applicationId", row[1]);
                notification.put("notificationType", row[2]);
                notification.put("toEmail", row[3]);
                notification.put("subject", row[4]);
                notification.put("body", row[5]);
                notification.put("sentAt", row[6]);
                notification.put("createdByUserId", row[7]);
                return notification;
            }).toList();

            return Response.ok(notifications).build();

        } catch (Exception e) {
            LOG.severe("Error fetching notifications: " + e.getMessage());
            e.printStackTrace();
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", e.getMessage())).build();
        } finally {
            if (em != null) {
                try {
                    em.close();
                } catch (Exception ignore) {
                }
            }
        }
    }

    /**
     * Get all notifications for an applicant (by applicant user ID)
     * GET /api/notifications/applicant/{applicantId}
     */
    @GET
    @Path("/applicant/{applicantId}")
    public Response getNotificationsByApplicant(@PathParam("applicantId") Long applicantId) {
        EntityManager em = null;
        try {
            em = getEmf().createEntityManager();

            // Query to get all notifications for all applications of this applicant
            String sql = "SELECT n.id, n.application_id, n.notification_type, n.to_email, n.subject, n.body, n.sent_at, n.created_by_user_id " +
                        "FROM notifications n " +
                        "JOIN applications a ON n.application_id = a.id " +
                        "WHERE a.applicant_user_id = ? " +
                        "ORDER BY n.sent_at DESC";

            List<Object[]> results = em.createNativeQuery(sql)
                    .setParameter(1, applicantId)
                    .getResultList();

            // Convert to JSON-friendly format
            var notifications = results.stream().map(row -> {
                Map<String, Object> notification = new HashMap<>();
                notification.put("id", row[0]);
                notification.put("applicationId", row[1]);
                notification.put("notificationType", row[2]);
                notification.put("toEmail", row[3]);
                notification.put("subject", row[4]);
                notification.put("body", row[5]);
                notification.put("sentAt", row[6]);
                notification.put("createdByUserId", row[7]);
                return notification;
            }).toList();

            return Response.ok(notifications).build();

        } catch (Exception e) {
            LOG.severe("Error fetching notifications for applicant: " + e.getMessage());
            e.printStackTrace();
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", e.getMessage())).build();
        } finally {
            if (em != null) {
                try {
                    em.close();
                } catch (Exception ignore) {
                }
            }
        }
    }
}

