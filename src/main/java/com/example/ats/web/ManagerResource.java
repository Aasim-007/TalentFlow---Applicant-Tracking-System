package com.example.ats.web;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import jakarta.persistence.*;
import java.util.*;
import java.util.logging.Logger;

@Path("/jobs/managers")
@Produces(MediaType.APPLICATION_JSON)
public class ManagerResource {
    private static volatile EntityManagerFactory EMF; // cache to avoid recreating per request
    private static final Logger LOG = Logger.getLogger(ManagerResource.class.getName());

    private EntityManagerFactory getEmf(){
        EntityManagerFactory local = EMF;
        if(local == null){
            synchronized (ManagerResource.class){
                local = EMF;
                if(local == null){
                    Map<String,String> overrides = new HashMap<>();
                    String envUrl = System.getenv("DB_URL");
                    String envUser = System.getenv("DB_USER");
                    String envPass = System.getenv("DB_PASSWORD");
                    String envSsl = System.getenv("DB_SSLMODE");
                    if (envUrl != null && !envUrl.isBlank()) overrides.put("jakarta.persistence.jdbc.url", envUrl);
                    if (envUser != null && !envUser.isBlank()) overrides.put("jakarta.persistence.jdbc.user", envUser);
                    if (envPass != null && !envPass.isBlank()) overrides.put("jakarta.persistence.jdbc.password", envPass);
                    if (envSsl != null && !envSsl.isBlank()){
                        if (overrides.containsKey("jakarta.persistence.jdbc.url") && !overrides.get("jakarta.persistence.jdbc.url").contains("sslmode=")){
                            String u = overrides.get("jakarta.persistence.jdbc.url");
                            String sep = u.contains("?") ? "&" : "?";
                            overrides.put("jakarta.persistence.jdbc.url", u + sep + "sslmode=" + envSsl);
                        }
                    }
                    try {
                        local = jakarta.persistence.Persistence.createEntityManagerFactory("ATS-PU", overrides);
                        EMF = local;
                    } catch(Exception e){
                        LOG.severe("Failed to create EMF for ManagerResource: " + e.getMessage());
                        throw e;
                    }
                }
            }
        }
        return local;
    }

    @GET
    public Response listManagers(){
        List<Map<String,Object>> out = new ArrayList<>();
        EntityManager em = null;
        try {
            em = getEmf().createEntityManager();
            // Query hiring managers (users with matching row in hiring_manager) ordered by name
            List<Object[]> rows = em.createNativeQuery("SELECT u.id, u.name FROM users u INNER JOIN hiring_manager h ON h.user_id = u.id WHERE u.role = 'hiring_manager' ORDER BY u.name ASC").getResultList();
            for(Object[] r: rows){
                Map<String,Object> m = new HashMap<>();
                m.put("id", ((Number)r[0]).longValue());
                m.put("name", r[1] == null ? "(Unnamed Manager)" : r[1].toString());
                out.add(m);
            }
            return Response.ok(out).build();
        } catch(Exception e){
            LOG.severe("Error fetching managers: " + e.getClass().getName() + ": " + e.getMessage());
            // Return empty list so frontend can show fallback text instead of failing
            return Response.ok(out).build();
        } finally {
            if(em != null){
                try { em.close(); } catch(Exception ignore){}
            }
        }
    }
}
