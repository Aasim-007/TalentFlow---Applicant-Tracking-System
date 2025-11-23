package com.example.ats.web;

import com.example.ats.dto.*;
import com.example.ats.repository.UserRepository;
import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.*;
import java.util.*;

@Path("/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {
    @Context
    private HttpServletRequest servletRequest;

    private static volatile EntityManagerFactory EMF; // lazy cache

    private EntityManagerFactory getEmf(){
        EntityManagerFactory local = EMF;
        if (local == null){
            synchronized (AuthResource.class){
                local = EMF; if (local == null){ EMF = local = jakarta.persistence.Persistence.createEntityManagerFactory("ATS-PU"); }
            }
        }
        return local;
    }

    private String roleToLanding(String role){
        if (role == null) return "/login/login.html";
        return switch (role) {
            case "hr" -> "/hr-landing/index.html";
            case "hiring_manager" -> "/manager-landing/index.html";
            case "applicant" -> "/applicant-landing/index.html";
            case "admin" -> "/hr-landing/index.html";
            default -> "/login/login.html";
        };
    }

    @POST
    @Path("/login")
    public Response login(LoginRequest req){
        if (req == null || req.getEmail() == null || req.getPassword() == null)
            return Response.status(Response.Status.BAD_REQUEST).entity(AuthResponse.error("Missing email or password")).build();
        try {
            UserRepository repo = new UserRepository(getEmf());
            var userOpt = repo.findUserByEmail(req.getEmail());
            if (userOpt.isEmpty())
                return Response.status(Response.Status.UNAUTHORIZED).entity(AuthResponse.error("Invalid credentials")).build();
            var user = userOpt.get();
            if (!Objects.equals(req.getPassword(), user.password))
                return Response.status(Response.Status.UNAUTHORIZED).entity(AuthResponse.error("Invalid credentials")).build();

            // Store user info in session
            if (servletRequest != null) {
                var session = servletRequest.getSession(true);
                session.setAttribute("userId", user.id);
                session.setAttribute("userRole", user.role);
                session.setAttribute("userName", user.name);
                session.setAttribute("userEmail", user.email);
            }

            String redirect = roleToLanding(user.role);
            return Response.ok(AuthResponse.ok(user.id, user.role, redirect)).build();
        } catch(Exception e){
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(AuthResponse.error(e.getClass().getSimpleName()+": "+e.getMessage())).build();
        }
    }

    @POST
    @Path("/signup")
    public Response signup(SignupRequest req){
        if (req == null || req.getEmail() == null || req.getPassword() == null || req.getName() == null || req.getRole() == null)
            return Response.status(Response.Status.BAD_REQUEST).entity(AuthResponse.error("Missing required fields")).build();
        String role = req.getRole().trim().toLowerCase(Locale.ROOT);
        if (!(role.equals("hr") || role.equals("hiring_manager") || role.equals("applicant") || role.equals("admin")))
            return Response.status(Response.Status.BAD_REQUEST).entity(AuthResponse.error("Invalid role")).build();

        try {
            UserRepository repo = new UserRepository(getEmf());
            if (repo.findUserByEmail(req.getEmail()).isPresent())
                return Response.status(Response.Status.CONFLICT).entity(AuthResponse.error("Email already registered")).build();

            long uid = repo.createUserAndRole(
                    req.getName(), req.getEmail(), req.getPassword(), role,
                    req.getEmployee_number(), req.getDepartment(),
                    req.getManager_code(), req.getTeam(),
                    req.getPhone(), req.getResume_text(), req.getLinkedin_url()
            );

            // Store user info in session
            if (servletRequest != null) {
                var session = servletRequest.getSession(true);
                session.setAttribute("userId", uid);
                session.setAttribute("userRole", role);
                session.setAttribute("userName", req.getName());
                session.setAttribute("userEmail", req.getEmail());
            }

            String redirect = roleToLanding(role);
            return Response.status(Response.Status.CREATED).entity(AuthResponse.ok(uid, role, redirect)).build();
        } catch(Exception e){
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(AuthResponse.error(e.getClass().getSimpleName()+": "+e.getMessage())).build();
        }
    }

    @GET
    @Path("/current-user")
    public Response getCurrentUser(){
        try {
            if (servletRequest == null || servletRequest.getSession(false) == null) {
                return Response.status(Response.Status.UNAUTHORIZED).entity(Map.of("error", "Not authenticated")).build();
            }

            var session = servletRequest.getSession(false);
            Long userId = (Long) session.getAttribute("userId");
            String userRole = (String) session.getAttribute("userRole");
            String userName = (String) session.getAttribute("userName");
            String userEmail = (String) session.getAttribute("userEmail");

            if (userId == null || userRole == null) {
                return Response.status(Response.Status.UNAUTHORIZED).entity(Map.of("error", "Not authenticated")).build();
            }

            Map<String, Object> userInfo = new HashMap<>();
            userInfo.put("userId", userId);
            userInfo.put("role", userRole);
            userInfo.put("name", userName);
            userInfo.put("email", userEmail);

            return Response.ok(userInfo).build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", e.getMessage())).build();
        }
    }

    @POST
    @Path("/logout")
    public Response logout(){
        try {
            if (servletRequest != null) {
                var session = servletRequest.getSession(false);
                if (session != null) {
                    session.invalidate();
                }
            }
            return Response.ok(Map.of("status", "success", "message", "Logged out successfully")).build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", e.getMessage())).build();
        }
    }
}
