package com.example.ats.dto;

public class AuthResponse {
    private String status;   // ok | error
    private String message;  // error details
    private Long userId;     // on success
    private String role;     // user role
    private String redirect; // landing page

    public static AuthResponse ok(Long userId, String role, String redirect){
        AuthResponse r = new AuthResponse();
        r.status = "ok"; r.userId = userId; r.role = role; r.redirect = redirect; return r;
    }
    public static AuthResponse error(String message){
        AuthResponse r = new AuthResponse(); r.status = "error"; r.message = message; return r;
    }

    public String getStatus(){ return status; }
    public String getMessage(){ return message; }
    public Long getUserId(){ return userId; }
    public String getRole(){ return role; }
    public String getRedirect(){ return redirect; }
}
