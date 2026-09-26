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
ENTRYPOINT ["java","-jar","app.jar"]
