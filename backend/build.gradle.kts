plugins {
    id("org.springframework.boot") version "4.0.8"
    id("io.spring.dependency-management") version "1.1.7"
    kotlin("jvm") version "2.2.21"
    kotlin("plugin.spring") version "2.2.21"
    kotlin("plugin.jpa") version "2.2.21"
}

group = "com.pillflow"
version = "0.1.0"
java { toolchain { languageVersion = JavaLanguageVersion.of(25) }; sourceCompatibility = JavaVersion.VERSION_21; targetCompatibility = JavaVersion.VERSION_21 }

repositories { mavenCentral() }

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-webmvc")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    implementation("org.springframework.boot:spring-boot-starter-flyway")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-security-oauth2-resource-server")
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.postgresql:postgresql")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.testcontainers:testcontainers-postgresql")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter")
    testImplementation("io.mockk:mockk:1.14.6")
}

kotlin { jvmToolchain(25); compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21); freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property") } }
tasks.withType<JavaCompile> { options.release.set(21) }
tasks.withType<Test> { useJUnitPlatform() }
