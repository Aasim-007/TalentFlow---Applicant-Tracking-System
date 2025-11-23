package com.example.ats.web;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.persistence.*;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class ApplicationFormServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        String path = req.getPathInfo(); // e.g. /123-job-title
        if (path == null || path.length() <= 1){ resp.sendError(HttpServletResponse.SC_NOT_FOUND); return; }
        String idPart = path.substring(1).split("-",2)[0];
        Long jobId;
        try { jobId = Long.valueOf(idPart); } catch(Exception e){ resp.sendError(HttpServletResponse.SC_NOT_FOUND); return; }

        // load job title and summary and jds
        try {
            EntityManagerFactory emf = jakarta.persistence.Persistence.createEntityManagerFactory("ATS-PU");
            EntityManager em = emf.createEntityManager();
            try {
                Object[] job = (Object[]) em.createNativeQuery("SELECT id, title, description_summary FROM jobs WHERE id = ?").setParameter(1, jobId).getSingleResult();
                @SuppressWarnings("unchecked")
                List<Object[]> jds = em.createNativeQuery("SELECT section_title, description FROM job_descriptions WHERE job_id = ? ORDER BY id").setParameter(1, jobId).getResultList();

                String title = job[1] == null ? "" : job[1].toString();
                String summary = job[2] == null ? "" : job[2].toString();

                resp.setContentType("text/html;charset=UTF-8");
                StringBuilder html = new StringBuilder();
                html.append("<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"> ");
                html.append("<title>Apply — "+escape(title)+"</title>");
                // minimal inline style reusing theme colors
                html.append("<style>body{font-family:Inter,Arial;background:#071428;color:#e9f3ff;padding:24px} .card{background:rgba(255,255,255,0.02);padding:18px;border-radius:12px;max-width:780px;margin:0 auto} label{display:block;margin-top:10px;color:#9aa7bb} input,textarea{width:100%;padding:10px;border-radius:10px;border:1px solid rgba(0,0,0,0.06);background:transparent;color:inherit} button{margin-top:12px;padding:10px 14px;border-radius:10px;border:0;background:linear-gradient(90deg,#6ee7b7,#60a5fa);color:#022027;font-weight:700}</style>");
                html.append("</head><body>");
                html.append("<div class=\"card\"><h2>Apply for: "+escape(title)+"</h2>");
                html.append("<div style=\"color:#9aa7bb;margin-bottom:12px\">"+escape(summary)+"</div>");
                html.append("<form method=\"post\" action=\"/api/jobs/apply\">\n");
                html.append("<input type=\"hidden\" name=\"job_id\" value=\""+jobId+"\">\n");
                html.append("<label>Name</label><input name=\"name\" required>\n");
                html.append("<label>Email</label><input name=\"email\" type=\"email\" required>\n");
                html.append("<label>Cover letter</label><textarea name=\"cover_letter\" rows=6></textarea>\n");
                html.append("<button type=\"submit\">Submit application</button>\n");
                html.append("</form>");

                if (jds != null && !jds.isEmpty()){
                    html.append("<h3 style=\"margin-top:18px\">Job sections</h3>");
                    html.append("<ul>");
                    for (Object[] r: jds){ html.append("<li><strong>"+escape((String)r[0]) + "</strong> - " + escape((String)r[1]) + "</li>"); }
                    html.append("</ul>");
                }
                html.append("</div></body></html>");
                resp.getWriter().write(html.toString());
            } finally { em.close(); emf.close(); }
        } catch(NoResultException nre){ resp.sendError(HttpServletResponse.SC_NOT_FOUND); }
        catch(Exception e){ resp.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, e.getMessage()); }
    }

    private static String escape(String s){ if(s==null) return ""; return s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;"); }
}

