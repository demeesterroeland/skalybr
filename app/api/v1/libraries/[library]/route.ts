import { NextRequest, NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';
import { getLibrarySettings, saveLibrarySettings } from '@/lib/library-settings';
import { closeDatabaseConnection } from '@/lib/calibre/db';
import { getLibraryPath, DEFAULT_CALIBRE_BASE_DIR } from '@/lib/config';
import { upsertLibraryRecord, setDefaultLibraryRecord, deleteLibraryRecord } from '@/lib/db/skalybr-db';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ library: string }> }) {
  try {
    const { library } = await params;
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR, true);
    const libData = libraries.find(l => l.name === library);
    
    if (!libData) {
      return NextResponse.json({ success: false, error: 'Library not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: libData,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ library: string }> }) {
  try {
    const { library } = await params;
    const body = await req.json();
    const { displayName, isHidden, isDefault, avatarImage } = body;

    const settings = getLibrarySettings();

    if (displayName !== undefined) {
      if (displayName.trim() === '') {
        delete settings.customNames[library];
      } else {
        settings.customNames[library] = displayName.trim();
      }
    }

    if (isHidden !== undefined) {
      if (isHidden) {
        if (!settings.hiddenLibraries.includes(library)) {
          settings.hiddenLibraries.push(library);
        }
      } else {
        settings.hiddenLibraries = settings.hiddenLibraries.filter((l) => l !== library);
      }
    }

    saveLibrarySettings(settings);

    if (isDefault) {
      setDefaultLibraryRecord(library);
    }

    if (avatarImage !== undefined) {
      upsertLibraryRecord({
        name: library,
        avatarImage,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Library settings updated successfully.',
      settings,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ library: string }> }) {
  try {
    const { library } = await params;

    const libPath = getLibraryPath(library);
    const resolvedPath = path.resolve(libPath);
    
    const resolvedBase = path.resolve(DEFAULT_CALIBRE_BASE_DIR);
    const resolvedCwd = path.resolve(process.cwd());
    if (!resolvedPath.startsWith(resolvedBase + path.sep) && !resolvedPath.startsWith(resolvedCwd + path.sep)) {
      return NextResponse.json({ success: false, error: 'Cannot delete outside allowed directories' }, { status: 403 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ success: false, error: 'Library directory does not exist' }, { status: 404 });
    }

    closeDatabaseConnection(resolvedPath);
    fs.rmSync(resolvedPath, { recursive: true, force: true });

    const settings = getLibrarySettings();
    delete settings.customNames[library];
    settings.hiddenLibraries = settings.hiddenLibraries.filter((l) => l !== library);
    saveLibrarySettings(settings);
    deleteLibraryRecord(library);

    return NextResponse.json({
      success: true,
      message: `Library "${library}" deleted permanently.`,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
