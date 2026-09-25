FROM gradle:9.3-jdk25 AS build
WORKDIR /workspace
COPY . .
RUN ./gradlew bootJar --no-daemon
FROM eclipse-temurin:21-jre
RUN useradd --system --create-home --uid 10001 pillflow
WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar app.jar
USER pillflow
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/actuator/health || exit 1
ENTRYPOINT ["java","-jar","app.jar"]
