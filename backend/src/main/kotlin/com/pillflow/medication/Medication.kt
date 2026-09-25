package com.pillflow.medication
import jakarta.persistence.*
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import org.hibernate.dialect.type.PostgreSQLEnumJdbcType
import java.time.OffsetDateTime
import java.util.UUID

enum class MedicationType { tablet, syrup, powder, ointment, drops, inhaler }
@Entity @Table(name="medications", schema="public")
class Medication(
 @Id @GeneratedValue(strategy=GenerationType.UUID) var id: UUID? = null,
 @Column(name="user_id", nullable=false) var userId: UUID,
 @Column(nullable=false) var name: String,
 @Column(nullable=false) var dosage: String,
 @Column(nullable=false) var memo: String = "",
 @Enumerated(EnumType.STRING) @JdbcTypeCode(SqlTypes.NAMED_ENUM) @Column(columnDefinition="med_type", nullable=false) var type: MedicationType,
 @Column(nullable=false) var color: String = "#6C63FF",
 @JdbcTypeCode(SqlTypes.ARRAY) @Column(nullable=false, columnDefinition="text[]") var times: Array<String>,
 @JdbcTypeCode(SqlTypes.ARRAY) @Column(nullable=false, columnDefinition="text[]") var days: Array<String>,
 @Column(name="created_at", nullable=false) var createdAt: OffsetDateTime? = null,
 @Column(name="updated_at", nullable=false) var updatedAt: OffsetDateTime? = null,
)
 { @PrePersist fun onCreate() { val now = OffsetDateTime.now(); createdAt = now; updatedAt = now } }
interface MedicationRepository : org.springframework.data.jpa.repository.JpaRepository<Medication, UUID>
