package com.example.ats.dto;

public class SignupRequest {
    private String name;
    private String email;
    private String password;
    private String role; // admin | hr | hiring_manager | applicant

    // Optional role-specific fields
    private String employee_number; // hr
    private String department;      // hr
    private String manager_code;    // hiring_manager
    private String team;            // hiring_manager
    private String phone;           // applicant
    private String resume_text;     // applicant
    private String linkedin_url;    // applicant

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getEmployee_number() { return employee_number; }
    public void setEmployee_number(String employee_number) { this.employee_number = employee_number; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getManager_code() { return manager_code; }
    public void setManager_code(String manager_code) { this.manager_code = manager_code; }
    public String getTeam() { return team; }
    public void setTeam(String team) { this.team = team; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getResume_text() { return resume_text; }
    public void setResume_text(String resume_text) { this.resume_text = resume_text; }
    public String getLinkedin_url() { return linkedin_url; }
    public void setLinkedin_url(String linkedin_url) { this.linkedin_url = linkedin_url; }
}
