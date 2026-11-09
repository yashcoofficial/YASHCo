FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace
COPY . .
RUN chmod +x ./mvnw && ./mvnw -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/target/yash-api-1.0.0.jar /app/yash-api.jar
EXPOSE 4000
ENTRYPOINT ["java", "-jar", "/app/yash-api.jar"]