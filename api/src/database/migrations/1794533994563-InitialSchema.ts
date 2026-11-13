import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1794533994563 implements MigrationInterface {
    name = 'InitialSchema1794533994563'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_settings" ("user_id" uuid NOT NULL, "mode" character varying(10) NOT NULL DEFAULT 'text', "voice" character varying(32) NOT NULL DEFAULT 'Kore', "lesson_level" character varying(4) NOT NULL DEFAULT 'A1', "conversation_level" character varying(4) NOT NULL DEFAULT 'A1', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_4ed056b9344e6f7d8d46ec4b302" PRIMARY KEY ("user_id"))`);
        await queryRunner.query(`CREATE TABLE "lesson_answers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "lesson_id" uuid NOT NULL, "word" character varying(64) NOT NULL, "guess" character varying(3) NOT NULL, "article" character varying(3) NOT NULL, "correct" boolean NOT NULL, CONSTRAINT "PK_9f4a05900bffe26b03e74f78407" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4906aaf742e411e0479a5746f7" ON "lesson_answers" ("lesson_id") `);
        await queryRunner.query(`CREATE TABLE "lessons" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "level" character varying(4) NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'in_progress', "lesson_number" integer NOT NULL, "groups" jsonb NOT NULL, "last_wrong" jsonb NOT NULL DEFAULT '[]', "score" integer, "total" integer NOT NULL, "mistakes" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_9b9a8d455cac672d262d7275730" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_584dd50f7074aae8e8820742df" ON "lessons" ("user_id", "level", "status") `);
        await queryRunner.query(`CREATE TABLE "scenario_completions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "level" character varying(4) NOT NULL, "scenario_id" character varying(64) NOT NULL, "scenario_title" character varying(120) NOT NULL, "turns" integer NOT NULL, "corrections" integer NOT NULL DEFAULT '0', "completed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_59301416088842fed7009f67909" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ac95c3d51d8c09cbaaef689fe6" ON "scenario_completions" ("user_id", "level", "scenario_id") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "email" character varying(254) NOT NULL, "display_name" character varying(50) NOT NULL, "password_hash" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user_settings" ADD CONSTRAINT "FK_4ed056b9344e6f7d8d46ec4b302" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_answers" ADD CONSTRAINT "FK_4906aaf742e411e0479a5746f7a" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lessons" ADD CONSTRAINT "FK_ddd9738993ea215c1b3b4a9977d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scenario_completions" ADD CONSTRAINT "FK_8a124f5db7d0b12366ab8d617e5" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scenario_completions" DROP CONSTRAINT "FK_8a124f5db7d0b12366ab8d617e5"`);
        await queryRunner.query(`ALTER TABLE "lessons" DROP CONSTRAINT "FK_ddd9738993ea215c1b3b4a9977d"`);
        await queryRunner.query(`ALTER TABLE "lesson_answers" DROP CONSTRAINT "FK_4906aaf742e411e0479a5746f7a"`);
        await queryRunner.query(`ALTER TABLE "user_settings" DROP CONSTRAINT "FK_4ed056b9344e6f7d8d46ec4b302"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ac95c3d51d8c09cbaaef689fe6"`);
        await queryRunner.query(`DROP TABLE "scenario_completions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_584dd50f7074aae8e8820742df"`);
        await queryRunner.query(`DROP TABLE "lessons"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4906aaf742e411e0479a5746f7"`);
        await queryRunner.query(`DROP TABLE "lesson_answers"`);
        await queryRunner.query(`DROP TABLE "user_settings"`);
    }

}
