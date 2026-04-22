# Cloudinary CDN Integration


### SDK Setup

**Package**: `cloudinary` (Node.js SDK v2)

**Configuration** (`app/lib/cloudinary.ts`):

```typescript
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };
```

### Upload Image

```typescript
import { cloudinary } from '@/app/lib/cloudinary';

export async function uploadImage(
  buffer: Buffer,
  ticketId: number,
  filename: string
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `ai-board/tickets/${ticketId}`,
        public_id: filename,
        resource_type: 'image',
        overwrite: false,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result!);
      }
    );

    uploadStream.end(buffer);
  });
}
```

### Delete Image

```typescript
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image',
    });

    console.log(`Deleted image: ${publicId}`);
  } catch (error) {
    console.error('Failed to delete image:', error);
    // Don't throw - continue with database operation
  }
}
```

### Folder Structure

```
ai-board/
└── tickets/
    ├── 1/
    │   ├── screenshot-1.png
    │   └── diagram-2.png
    ├── 2/
    │   └── mockup-3.png
    └── 42/
        └── bug-screenshot-4.png
```

### API Route Pattern

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  // Validate file
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }

  // Convert to buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Upload to Cloudinary
  const result = await uploadImage(buffer, ticketId, file.name);

  // Store metadata in database
  const attachment: TicketAttachment = {
    type: 'uploaded',
    url: result.secure_url,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    uploadedAt: new Date().toISOString(),
    cloudinaryPublicId: result.public_id,
  };

  // Update ticket attachments
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      attachments: {
        push: attachment,
      },
    },
  });

  return NextResponse.json({ attachment });
}
```

### Environment Variables

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abc123def456
```

### Free Tier Limits

- **Storage**: 25GB
- **Bandwidth**: 25GB/month
- **Transformations**: 25,000/month
- **Requests**: Unlimited

### Error Handling

```typescript
try {
  const result = await uploadImage(buffer, ticketId, filename);
} catch (error: any) {
  if (error.http_code === 420) {
    throw new Error('Rate limit exceeded');
  } else if (error.http_code === 500) {
    throw new Error('Cloudinary service error');
  } else {
    throw new Error(`Upload failed: ${error.message}`);
  }
}
```

