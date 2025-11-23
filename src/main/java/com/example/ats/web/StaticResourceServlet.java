package com.example.ats.web;

import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

public class StaticResourceServlet extends HttpServlet {
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        // Build resource path relative to webapp root.
        // Use request URI minus context path so this works for exact mappings and wildcard mappings.
        String requestUri = req.getRequestURI(); // e.g. /add-job/add-job.html
        String context = req.getContextPath(); // usually ""
        String resourcePath = requestUri.substring(context.length()); // e.g. /add-job/add-job.html
        if (resourcePath.equals("/") || resourcePath.isEmpty()){
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            resp.getWriter().write("Not Found");
            return;
        }
        InputStream is = getServletContext().getResourceAsStream(resourcePath);
        if (is == null) {
            resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            resp.getWriter().write("Not Found");
            return;
        }
        String lower = resourcePath.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html") || lower.endsWith(".htm")) resp.setContentType("text/html;charset=UTF-8");
        else if (lower.endsWith(".js")) resp.setContentType("application/javascript;charset=UTF-8");
        else if (lower.endsWith(".css")) resp.setContentType("text/css;charset=UTF-8");
        else if (lower.endsWith(".png")) resp.setContentType("image/png");
        else if (lower.endsWith(".svg")) resp.setContentType("image/svg+xml");
        else resp.setContentType("application/octet-stream");

        // copy stream
        byte[] buf = new byte[8192];
        int r;
        try (InputStream input = is) {
            while ((r = input.read(buf)) != -1) {
                resp.getOutputStream().write(buf, 0, r);
            }
        }
    }
}
