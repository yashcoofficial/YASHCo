package com.yash.api.security;

import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class MailService {
    @Value("${RESEND_API_KEY:}")
    private String resendApiKey;
    @Value("${EMAIL_FROM:concierge@yashatelier.store}")
    private String defaultFrom;
    @Value("${SMTP_HOST:}")
    private String smtpHost;
    @Value("${SMTP_PORT:587}")
    private int smtpPort;
    @Value("${SMTP_SECURE:false}")
    private boolean smtpSecure;
    @Value("${SMTP_USER:}")
    private String smtpUser;
    @Value("${SMTP_PASS:}")
    private String smtpPassword;

    public void send(String to, String from, String subject, String text, String html) {
        String sender = from == null || from.isBlank() ? defaultFrom : from;
        if (resendApiKey != null && !resendApiKey.isBlank()) {
            RestClient.create("https://api.resend.com")
                    .post().uri("/emails")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + resendApiKey)
                    .body(Map.of("from", sender, "to", List.of(to), "subject", subject, "text", text, "html", html))
                    .retrieve().toBodilessEntity();
            return;
        }

        if (smtpHost != null && !smtpHost.isBlank()) {
            JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
            mailSender.setHost(smtpHost);
            mailSender.setPort(smtpPort);
            mailSender.setUsername(smtpUser);
            mailSender.setPassword(smtpPassword);
            mailSender.setDefaultEncoding("UTF-8");
            var properties = mailSender.getJavaMailProperties();
            properties.put("mail.smtp.auth", !smtpUser.isBlank());
            properties.put("mail.smtp.starttls.enable", !smtpSecure);
            properties.put("mail.smtp.ssl.enable", smtpSecure);
            var message = mailSender.createMimeMessage();
            try {
                MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
                helper.setFrom(sender);
                helper.setTo(to);
                helper.setSubject(subject);
                helper.setText(text, html);
                mailSender.send(message);
            } catch (Exception error) {
                throw new IllegalStateException("Email provider rejected the request", error);
            }
            return;
        }

        System.out.printf("[mail] to=%s from=%s subject=%s%n", to, sender, subject);
    }
}