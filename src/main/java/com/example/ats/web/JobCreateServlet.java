package com.example.ats.web;

import com.example.ats.dto.JobCreateRequest;
import com.example.ats.entity.Job;
import com.example.ats.service.JobService;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

/**
 * Lightweight servlet that accepts the specific JSON shape emitted by the add-job UI.
 * This avoids adding a JSON library as a compile-time dependency in the project.
 */
public class JobCreateServlet extends HttpServlet {
    private static final Logger LOG = Logger.getLogger(JobCreateServlet.class.getName());
    private JobService jobService;

    @Override
    public void init() throws ServletException {
        super.init();
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String bodyText = new String(req.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        JobCreateRequest body;
        try {
            body = parseBody(bodyText);
        } catch (Exception e){
            LOG.severe("Failed to parse request body: " + e.getMessage());
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write("{\"status\":\"error\",\"reason\":\"Invalid JSON payload\"}");
            return;
        }

        // lazy-init JobService (persistence must succeed). Allow runtime overrides via env vars to avoid committing secrets.
        if (this.jobService == null){
            try {
                // build override properties from environment if present
                java.util.Map<String,String> overrides = new java.util.HashMap<>();
                String envUrl = System.getenv("DB_URL");
                String envUser = System.getenv("DB_USER");
                String envPass = System.getenv("DB_PASSWORD");
                String envSsl = System.getenv("DB_SSLMODE");
                if (envUrl != null && !envUrl.isBlank()) overrides.put("jakarta.persistence.jdbc.url", envUrl);
                if (envUser != null && !envUser.isBlank()) overrides.put("jakarta.persistence.jdbc.user", envUser);
                if (envPass != null && !envPass.isBlank()) overrides.put("jakarta.persistence.jdbc.password", envPass);
                if (envSsl != null && !envSsl.isBlank()) {
                    // if user provided just sslmode value, apply to URL if not already present
                    if (overrides.containsKey("jakarta.persistence.jdbc.url") && !overrides.get("jakarta.persistence.jdbc.url").contains("sslmode=")){
                        String u = overrides.get("jakarta.persistence.jdbc.url");
                        String sep = u.contains("?") ? "&" : "?";
                        overrides.put("jakarta.persistence.jdbc.url", u + sep + "sslmode=" + envSsl);
                    } else {
                        overrides.put("hibernate.connection.provider_disables_autocommit", "true");
                    }
                }

                var emf = jakarta.persistence.Persistence.createEntityManagerFactory("ATS-PU", overrides);
                this.jobService = new com.example.ats.service.JobService(emf);
            } catch (Exception e){
                LOG.severe(() -> "Failed to initialize JPA JobService in JobCreateServlet: " + e.getClass().getName() + ": " + e.getMessage());
                resp.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
                resp.setContentType("application/json;charset=UTF-8");
                String safe = e.getMessage() == null ? e.getClass().getName() : e.getClass().getName() + ": " + e.getMessage();
                resp.getWriter().write("{\"status\":\"error\",\"reason\":\"Service unavailable: persistence initialization failed\",\"details\":\"" + safe.replace("\"","\\\"") + "\"}");
                return;
            }
        }

        try {
            Job saved = this.jobService.createFromDto(body);
            if (saved.getId() == null){
                LOG.severe("Job saved but no ID returned; treating as failure.");
                resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
                resp.setContentType("application/json;charset=UTF-8");
                resp.getWriter().write("{\"status\":\"error\",\"reason\":\"Failed to persist job (no id returned)\"}");
                return;
            }
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write("{\"status\":\"success\", \"JobID\":" + saved.getId() + "}");
        } catch (Exception ex){
            LOG.severe("Error persisting job: " + ex.getClass().getName() + ": " + ex.getMessage());
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.setContentType("application/json;charset=UTF-8");
            resp.getWriter().write("{\"status\":\"error\",\"reason\":\"" + ex.getMessage().replace("\"","\\\"") + "\"}");
        }
    }

    // Very small parser that extracts the expected fields from the UI payload. It's intentionally lightweight
    // and only supports the shape produced by the add-job UI: {"job_title":"...","jds":[{...},...]}
    private JobCreateRequest parseBody(String s){
        JobCreateRequest out = new JobCreateRequest();
        String lower = s.trim();
        // extract job_title
        String jt = extractStringField(lower, "job_title");
        out.setJob_title(jt != null ? jt : "");

        out.setDepartment(extractStringField(lower, "department"));
        out.setLocation(extractStringField(lower, "location"));
        out.setEmployment_type(extractStringField(lower, "employment_type"));
        String sMin = extractNumberInline(lower, "salary_min");
        if (sMin != null){ try { out.setSalary_min(new java.math.BigDecimal(sMin)); } catch(Exception e){} }
        String sMax = extractNumberInline(lower, "salary_max");
        if (sMax != null){ try { out.setSalary_max(new java.math.BigDecimal(sMax)); } catch(Exception e){} }
        String ad = extractStringField(lower, "application_deadline");
        out.setApplication_deadline(ad);
        out.setDescription_summary(extractStringField(lower, "description_summary"));
        out.setStatus(extractStringField(lower, "status"));
        String mgr = extractNumberInline(lower, "managed_by_manager_id");
        if (mgr != null){ try { out.setManaged_by_manager_id(Long.valueOf((long)Double.parseDouble(mgr))); } catch(Exception e){} }

        List<JobCreateRequest.JD> jds = new ArrayList<>();
        int jdsIdx = lower.indexOf("\"jds\"");
        if (jdsIdx >= 0){
            int arrStart = lower.indexOf('[', jdsIdx);
            int arrEnd = findMatchingBracket(lower, arrStart);
            if (arrStart >= 0 && arrEnd > arrStart){
                String arr = lower.substring(arrStart+1, arrEnd).trim();
                // parse objects by scanning braces to avoid fragile regex escaping
                for (String obj : splitObjects(arr)){
                    String p = obj.trim();
                    if (p.startsWith("{")) p = p.substring(1).trim();
                    if (p.endsWith("}")) p = p.substring(0, p.length()-1).trim();
                    if (p.isEmpty()) continue;
                    JobCreateRequest.JD jd = new JobCreateRequest.JD();
                    jd.setTitle(extractStringField(p, "title"));
                    jd.setDescription(extractStringField(p, "description"));
                    String w = extractNumberField(p);
                    try { jd.setWeight(w == null ? null : (int) Double.parseDouble(w)); } catch(Exception e){ jd.setWeight(null); }
                    jds.add(jd);
                }
            }
        }
        out.setJds(jds);
        return out;
    }

    // extract numeric field by name (integer/float) from source, returns string or null
    private static String extractNumberInline(String src, String field){
        String key = "\"" + field + "\"";
        int idx = src.indexOf(key);
        if (idx < 0) return null;
        int colon = src.indexOf(':', idx+key.length());
        if (colon < 0) return null;
        int i = colon+1;
        while (i < src.length() && Character.isWhitespace(src.charAt(i))) i++;
        int start = i;
        while (i < src.length() && (Character.isDigit(src.charAt(i)) || src.charAt(i)=='.' || src.charAt(i)=='-' )) i++;
        if (start==i) return null;
        return src.substring(start, i);
    }

    private static String extractStringField(String src, String field){
        String key = "\"" + field + "\"";
        int idx = src.indexOf(key);
        if (idx < 0) return null;
        int colon = src.indexOf(':', idx+key.length());
        if (colon < 0) return null;
        int quote = src.indexOf('"', colon+1);
        if (quote < 0) return null;
        StringBuilder sb = new StringBuilder();
        boolean esc = false;
        for (int i = quote+1; i < src.length(); i++){
            char c = src.charAt(i);
            if (esc){ sb.append(c); esc = false; continue; }
            if (c == '\\') { esc = true; continue; }
            if (c == '"') { break; }
            sb.append(c);
        }
        return sb.toString();
    }

    private static String extractNumberField(String src){
        // We only need to extract the 'weight' numeric field in this servlet's payload.
        String key = "\"weight\"";
        int idx = src.indexOf(key);
        if (idx < 0) return null;
        int colon = src.indexOf(':', idx+key.length());
        if (colon < 0) return null;
        int i = colon+1;
        // skip spaces
        while (i < src.length() && Character.isWhitespace(src.charAt(i))) i++;
        int start = i;
        while (i < src.length() && (Character.isDigit(src.charAt(i)) || src.charAt(i)=='.' || src.charAt(i)=='-' )) i++;
        if (start==i) return null;
        return src.substring(start, i);
    }

    private static int findMatchingBracket(String s, int startIdx){
        if (startIdx < 0 || startIdx >= s.length() || s.charAt(startIdx) != '[') return -1;
        int depth = 0;
        for (int i = startIdx; i < s.length(); i++){
            char c = s.charAt(i);
            if (c == '[') depth++;
            else if (c == ']'){
                depth--;
                if (depth == 0) return i;
            }
        }
        return -1;
    }

    private static List<String> splitObjects(String s){
        List<String> out = new ArrayList<>();
        int depth = 0;
        int start = -1;
        for (int i = 0; i < s.length(); i++){
            char c = s.charAt(i);
            if (c == '{'){
                if (depth == 0) start = i;
                depth++;
            } else if (c == '}'){
                depth--;
                if (depth == 0 && start != -1){
                    out.add(s.substring(start, i+1));
                    start = -1;
                }
            }
        }
        return out;
    }
}
