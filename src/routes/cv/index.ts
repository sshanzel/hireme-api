import {FastifyInstance} from 'fastify';
import {withAuth, AuthenticatedRequest} from '../../utils/auth-helper.ts';
import {publish} from '../../services/pubsub.ts';
import {uploadFile} from '../../services/storage.ts';
import {FileStatus, fileTable as fileTable, SourceType} from '../../db/schema/file.ts';
import {db} from '../../db/index.ts';
import {BUCKET_NAME, UNPARSED_CVS_FOLDER} from '../../services/gcp.ts';
import {userTable} from '../../db/schema/user.ts';
import {eq} from 'drizzle-orm';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Rate limit for CV uploads - stricter to prevent parser API cost abuse
const cvUploadRateLimit = {
  max: 3,
  timeWindow: '1 hour',
  errorResponseBuilder: () => ({
    error: 'Too Many Requests',
    message: 'Upload limit reached. Please try again later.',
  }),
};

export default async function cvRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    '/upload',
    {config: {rateLimit: cvUploadRateLimit}},
    withAuth(async (request: AuthenticatedRequest, reply) => {
      const file = await request.file();

      if (!file) {
        return reply.status(400).send({error: 'No file uploaded'});
      }

      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        return reply.status(400).send({
          error: 'Invalid file type. Allowed: PDF, DOC, DOCX',
        });
      }

      const buffer = await file.toBuffer();

      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({
          error: 'File too large. Maximum size: 10MB',
        });
      }

      const ext = file.filename.split('.').pop();
      const finalPath = `${UNPARSED_CVS_FOLDER}/${request.user.id}.${ext}`;

      await uploadFile(buffer, finalPath, file.mimetype);

      await db.transaction(async trx => {
        const record = await trx
          .insert(fileTable)
          .values({
            userId: request.user.id,
            originalFileName: file.filename,
            mimeType: file.mimetype,
            gcsBucket: BUCKET_NAME,
            gcsPath: finalPath,
            sizeInBytes: buffer.length,
            status: FileStatus.Uploaded,
            tags: ['cv'],
            sourceType: SourceType.Resume,
          })
          .returning();

        const fileId = record[0].id;

        await trx
          .update(userTable)
          .set({cvUploadedAt: new Date()})
          .where(eq(userTable.id, request.user.id));

        await publish('api.v1.cv-uploaded', {fileId});
      });

      return reply.status(202).send({
        message: 'CV upload accepted for processing',
        fileName: file.filename,
        size: buffer.length,
      });
    }),
  );
}
