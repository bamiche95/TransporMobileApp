export const generateWasteTransferNote = async (jobId: string, makeAuthenticatedRequest: any) => {
    try {
        const response = await makeAuthenticatedRequest(`/job/${jobId}/waste-transfer-note`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jobId,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            return data;
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to generate waste transfer note');
        }
    } catch (error) {
        throw error;
    }
};