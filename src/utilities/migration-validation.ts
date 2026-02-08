// src/utilities/migration-validation.ts

import payload from 'payload';
// Import types as needed for more specific validation
// import { Space } from '../payload-types'; // Example

interface OriginalItem {
  id: string;
  [key: string]: any;
}

interface MigratedJsonContainer {
  id: string; // ID of the container document (e.g., Space, Tenant, User)
  jsonData: any; // The JSON field itself (e.g., space.data, tenant.jsonData)
  [key: string]: any;
}

/**
 * Placeholder function to validate a batch of migrated data.
 * This function would compare original items against their migrated counterparts
 * within the JSON fields.
 *
 * @param collectionSlug Slug of the parent collection being processed (e.g., 'spaces').
 * @param batchNumber The current batch number for logging.
 * @param originalItems An array of original items from a source collection (e.g., original messages).
 * @param migratedParentItem The parent item containing the JSON field where originalItems should now reside (e.g., a Space document).
 * @param targetPathInJson The key within the parent's JSON field where the migrated items are stored (e.g., 'messages' in Space.data).
 */
export async function validateMigratedBatchDetails(
  collectionSlug: string,
  batchNumber: number,
  originalItems: OriginalItem[],
  migratedParentItem: MigratedJsonContainer,
  targetPathInJson: string,
): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
  checkedCount: number;
  matchCount: number;
}> {
  console.log(`[Validation] Batch ${batchNumber} for ${collectionSlug} - Parent ID ${migratedParentItem.id}, Target Path: ${targetPathInJson}`);
  const results = {
    valid: true,
    errors: [] as string[],
    warnings: [] as string[],
    checkedCount: originalItems.length,
    matchCount: 0,
  };

  const migratedItemsArray = migratedParentItem.jsonData?.[targetPathInJson];

  if (!migratedItemsArray || !Array.isArray(migratedItemsArray)) {
    results.errors.push(`Migrated items array not found or not an array at ${targetPathInJson} in Parent ID ${migratedParentItem.id}`);
    results.valid = false;
    return results;
  }

  if (originalItems.length !== migratedItemsArray.length) {
    results.warnings.push(
      `Count mismatch for Parent ID ${migratedParentItem.id} at path ${targetPathInJson}: Originals (${originalItems.length}), Migrated (${migratedItemsArray.length})`
    );
    // Depending on strategy, this might be an error. For now, a warning.
  }

  for (const originalItem of originalItems) {
    const migratedItem = migratedItemsArray.find(mItem => mItem.id === originalItem.id); // Assuming 'id' is preserved and is the key.

    if (!migratedItem) {
      results.errors.push(`Original item ID ${originalItem.id} not found in migrated data for Parent ID ${migratedParentItem.id} at path ${targetPathInJson}`);
      results.valid = false;
      continue;
    }

    // TODO: Implement more detailed field-by-field comparison logic here.
    // This is a very basic check.
    // Example: Compare a critical field
    // if (originalItem.criticalField !== migratedItem.criticalFieldTransformed) {
    //   results.errors.push(`Field mismatch for item ID ${originalItem.id}: criticalField`);
    //   results.valid = false;
    // }

    results.matchCount++;
  }

  if (results.errors.length > 0) results.valid = false;

  console.log(`[Validation] Batch ${batchNumber} for ${collectionSlug} - Parent ID ${migratedParentItem.id} - Finished. Valid: ${results.valid}, Matches: ${results.matchCount}/${results.checkedCount}, Errors: ${results.errors.length}, Warnings: ${results.warnings.length}`);
  return results;
}


/**
 * Placeholder for a higher-level validation function that might be called
 * after a certain stage of migration (e.g., after all spaces are processed for messages).
 *
 * @param sourceCollectionSlug Slug of the original collection (e.g., 'messages').
 * @param targetCollectionSlug Slug of the collection containing the JSON field (e.g., 'spaces').
 * @param targetJsonPath Path within the JSON field (e.g., 'data.messages').
 */
export async function validateOverallIntegrity(
  sourceCollectionSlug: string,
  targetCollectionSlug: string,
  targetJsonPath: string,
): Promise<{ totalOriginal: number; totalMigrated: number; issues: string[] }> {
  console.log(`[Validation] Overall integrity check for ${sourceCollectionSlug} -> ${targetCollectionSlug}.${targetJsonPath}`);
  const results = { totalOriginal: 0, totalMigrated: 0, issues: [] as string[] };

  try {
    // Count original items
    const originalFindResult = await payload.find({
      collection: sourceCollectionSlug as any,
      limit: 0, // Just get total count
      depth: 0,
      overrideAccess: true,
    });
    results.totalOriginal = originalFindResult.totalDocs;

    // Count migrated items (this is more complex as it's inside JSON fields)
    // This requires iterating through all parent documents and summing up array lengths.
    let migratedCount = 0;
    let page = 1;
    let parentDocsResult;
    const pathParts = targetJsonPath.split('.'); // e.g., ['data', 'messages']
    const jsonFieldName = pathParts[0];
    const arrayFieldName = pathParts.length > 1 ? pathParts[1] : null;


    do {
      parentDocsResult = await payload.find({
        collection: targetCollectionSlug as any,
        limit: 100, // BATCH_SIZE can be used here too
        page,
        depth: 0, // Only need the JSON field
        overrideAccess: true,
      });

      for (const parentDoc of parentDocsResult.docs) {
        if (!jsonFieldName) continue;
        const jsonField = parentDoc[jsonFieldName];
        if (jsonField && arrayFieldName && Array.isArray(jsonField[arrayFieldName])) {
          migratedCount += jsonField[arrayFieldName].length;
        } else if (jsonField && !arrayFieldName && Array.isArray(jsonField)) {
          // If targetJsonPath is just the jsonFieldName and it's an array directly
          migratedCount += jsonField.length;
        }
      }
      page += 1;
    } while (parentDocsResult.hasNextPage);
    results.totalMigrated = migratedCount;

    if (results.totalOriginal !== results.totalMigrated) {
      results.issues.push(
        `Count mismatch: Original ${sourceCollectionSlug} (${results.totalOriginal}), Migrated in ${targetCollectionSlug}.${targetJsonPath} (${results.totalMigrated})`
      );
    }

    console.log(`[Validation] Overall counts - Original: ${results.totalOriginal}, Migrated: ${results.totalMigrated}. Issues: ${results.issues.length}`);

  } catch (error) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     if (errorMessage.includes(`Collection with slug '${sourceCollectionSlug}' not found`)) {
        console.warn(`[Validation] Source collection ${sourceCollectionSlug} not found. Skipping overall integrity count for it.`);
     } else {
        console.error(`[Validation] Error during overall integrity check for ${sourceCollectionSlug}:`, error);
        results.issues.push(`Error during check: ${errorMessage}`);
     }
  }
  return results;
}

// Future enhancements:
// - More sophisticated data comparison (deep equality checks, type checks).
// - Checksum/hashing for data verification.
// - Validation of relationships (e.g., if an ID stored in JSON still points to a valid document).
// - Schema validation against TypeScript types (might require more advanced tooling).
