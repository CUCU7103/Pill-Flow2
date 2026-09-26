package com.pillflow.intake
import jakarta.persistence.*
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
@Entity @Table(name="medication_logs", schema="public", uniqueConstraints=[UniqueConstraint(name="uq_medication_logs_medication_date", columnNames=["medication_id","taken_on"])])
class MedicationLog(
 @Id @GeneratedValue(strategy=GenerationType.UUID) var id: UUID? = null,
 @Column(name="medication_id", nullable=false) var medicationId: UUID,
 @Column(name="user_id", nullable=false) var userId: UUID,
 @Column(name="taken_on", nullable=false) var takenOn: LocalDate,
 @Column(name="taken_at", nullable=false) var takenAt: OffsetDateTime? = null,
)
 { @PrePersist fun onCreate() { takenAt = OffsetDateTime.now() } }
interface MedicationLogRepository : org.springframework.data.jpa.repository.JpaRepository<MedicationLog, UUID> {
 fun findAllByUserIdAndTakenOn(userId: UUID, takenOn: LocalDate): List<MedicationLog>

 fun findAllByUserIdAndTakenOnBetween(userId: UUID, from: LocalDate, to: LocalDate): List<MedicationLog>

 @Modifying
 @Query(
  value = """
   INSERT INTO public.medication_logs (medication_id, user_id, taken_on)
   VALUES (:medicationId, :userId, :takenOn)
   ON CONFLICT (medication_id, taken_on) DO NOTHING
  """,
  nativeQuery = true,
 )
 fun insertIfAbsent(
  @Param("medicationId") medicationId: UUID,
  @Param("userId") userId: UUID,
  @Param("takenOn") takenOn: LocalDate,
 ): Int

 @Modifying
 @Query(
  "delete from MedicationLog l where l.medicationId = :medicationId and l.userId = :userId and l.takenOn = :takenOn",
 )
 fun deleteByMedicationIdAndUserIdAndTakenOn(
  @Param("medicationId") medicationId: UUID,
  @Param("userId") userId: UUID,
  @Param("takenOn") takenOn: LocalDate,
 ): Int
}
