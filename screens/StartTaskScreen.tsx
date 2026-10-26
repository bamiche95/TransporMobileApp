import React, { useEffect, useState, useRef, ReactNode } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert, TouchableOpacity, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import Base_URL from '../lib/config';
import BottomSheet, { BottomSheetView, BottomSheetFlatList, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';

interface Job {
  job_id: number;
  qty: number;
  job_type_name: string;
  allows_collect: number;
  allows_deliver: number;
  lug_lock: number;
  bin_name: string;
  has_bins?: number;
}

interface LugLock {
  display_id: ReactNode;
  lug_id: number;
  key_code: string;
  colour: string;
  type_name: string;
}

interface BinAssignment {
  collectBinNo: string;
  deliverBinNo: string;
  collectValid?: boolean | 'checking';
  deliverValid?: boolean | 'checking';
  collectManual?: boolean;
  deliverManual?: boolean;
  collectSource?: 'scan' | 'manual';
  deliverSource?: 'scan' | 'manual';
}

const StartTaskScreen = ({ route }: any) => {
  const { jobId } = route.params;
  const navigation = useNavigation();
  const { makeAuthenticatedRequest } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [binAssignments, setBinAssignments] = useState<BinAssignment[]>([]);
  const [loading, setLoading] = useState(true);
const [submitting, setSubmitting] = useState(false);

  // Lug Lock State
  const [availableLugLocks, setAvailableLugLocks] = useState<LugLock[]>([]);
  const [selectedLugLocks, setSelectedLugLocks] = useState<number[]>([]);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = ['50%', '90%'];

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerTarget, setScannerTarget] = useState<{ index: number, field: 'collectBinNo' | 'deliverBinNo' } | null>(null);

  // Refs for auto-focus functionality
  const inputRefs = useRef<(TextInput | null)[][]>([]);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const response = await makeAuthenticatedRequest(`/job/${jobId}`, {
          headers: { 'Cache-Control': 'no-cache' },
        });
        const data = await response.json();
        if (response.ok) {
          const isTransport = data.job.job_type_name?.toLowerCase() === 'transport';
          const isFlatbed = data.job.bin_name?.toLowerCase() === 'flatbed material transport';

          if (data.job.has_bins === 1 || (isTransport && isFlatbed)) {
            (navigation as any).replace('Signature', { jobId });
            return;
          }

          setJob(data.job);
          // Initialize bin assignments based on qty
          const assignments = [];
          for (let i = 0; i < data.job.qty; i++) {
            assignments.push({
              collectBinNo: '',
              deliverBinNo: '',
              collectValid: undefined,
              deliverValid: undefined,
              collectManual: false,
              deliverManual: false,
              collectSource: undefined,
              deliverSource: undefined,
            });
          }
          setBinAssignments(assignments);

          // Fetch lug locks if required
          if (data.job.lug_lock === 1) {
            fetchLugLocks();
          }
        } else {
          Alert.alert('Error', data.error);
        }
      } catch (error) {
        Alert.alert('Error', 'Unable to fetch job');
      } finally {
        setLoading(false);
      }
    };
    fetchJob();
  }, [jobId, makeAuthenticatedRequest]);

  const fetchLugLocks = async () => {
    try {
      const response = await makeAuthenticatedRequest(`/lug-locks/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setAvailableLugLocks(data.lug_locks);
      }
    } catch (error) {
      console.error('Error fetching lug locks:', error);
    }
  };

  const toggleLugLock = (id: number) => {
    setSelectedLugLocks(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const validateBinNumber = async (index: number, field: 'collect' | 'deliver', value: string) => {
// ... (rest of the validation logic remains same)
    if (!value) {
      setBinAssignments(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [`${field}Valid`]: undefined };
        return updated;
      });
      return;
    }

    setBinAssignments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [`${field}Valid`]: 'checking' };
      return updated;
    });

    try {
      const response = await makeAuthenticatedRequest(`/bins/check?bin_number=${encodeURIComponent(value)}`);
      const data = await response.json();
      setBinAssignments(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [`${field}Valid`]: data.exists };
        return updated;
      });
    } catch (err) {
      console.error('Validation error:', err);
    }
  };

  const handleBinChange = (index: number, field: 'collectBinNo' | 'deliverBinNo', value: string) => {
    // Only allow numeric input and limit to 6 digits
    const numericValue = value.replace(/[^0-9]/g, '').substring(0, 6);

    const updated = [...binAssignments];
    updated[index][field] = numericValue;
    setBinAssignments(updated);

    // Auto-focus to next input when 6 digits are entered
    if (numericValue.length === 6) {
      focusNextInput(index, field);
    }
  };

  const focusNextInput = (currentIndex: number, currentField: 'collectBinNo' | 'deliverBinNo') => {
    const config = {
      showCollect: job?.allows_collect === 1,
      showDeliver: job?.allows_deliver === 1,
      singleBinOnly: ['Tip And Return', 'Relocate', 'Transport', 'Wait and Load'].includes(job?.job_type_name || ''),
      isExchange: job?.job_type_name === 'Exchange',
    };

    if (config.singleBinOnly) {
      // For single bin, move to next item's input
      if (currentIndex < binAssignments.length - 1) {
        const nextRef = inputRefs.current[currentIndex + 1]?.[0];
        nextRef?.focus();
      }
    } else if (config.isExchange) {
      if (currentField === 'deliverBinNo') {
        if (currentIndex < binAssignments.length - 1) {
          const nextDeliverRef = inputRefs.current[currentIndex + 1]?.[0];
          nextDeliverRef?.focus();
        } else {
          // go to first collect
          const firstCollectRef = inputRefs.current[0]?.[1];
          firstCollectRef?.focus();
        }
      } else { // collectBinNo
        if (currentIndex < binAssignments.length - 1) {
          const nextCollectRef = inputRefs.current[currentIndex + 1]?.[1];
          nextCollectRef?.focus();
        }
      }
    } else {
      // For collect/deliver, move to deliver input or next item's collect input
      if (currentField === 'collectBinNo' && config.showDeliver) {
        const deliverRef = inputRefs.current[currentIndex]?.[1];
        deliverRef?.focus();
      } else if (currentIndex < binAssignments.length - 1) {
        const nextCollectRef = inputRefs.current[currentIndex + 1]?.[0];
        nextCollectRef?.focus();
      }
    }
  };

  const handleScanPress = async (index: number, field: 'collectBinNo' | 'deliverBinNo') => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert(
          'Camera permission needed',
          'Camera access is required to scan bin barcodes. You can enter the bin number manually instead.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Enter manually', onPress: () => openManualEntry({ index, field }) },
          ]
        );
        return;
      }
    }
    setScannerTarget({ index, field });
  };

  // Captures a value obtained from the scanner, marks its source and validates it
  const applyScannedValue = (index: number, field: 'collectBinNo' | 'deliverBinNo', value: string) => {
    setBinAssignments(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      if (field === 'collectBinNo') {
        row.collectBinNo = value;
        row.collectManual = false;
        row.collectSource = 'scan';
      } else {
        row.deliverBinNo = value;
        row.deliverManual = false;
        row.deliverSource = 'scan';
      }
      updated[index] = row;
      return updated;
    });
    validateBinNumber(index, field === 'collectBinNo' ? 'collect' : 'deliver', value);
  };

  // Clears a captured value so the driver can scan again or start a manual entry
  const clearBinField = (index: number, field: 'collectBinNo' | 'deliverBinNo') => {
    setBinAssignments(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      if (field === 'collectBinNo') {
        row.collectBinNo = '';
        row.collectValid = undefined;
        row.collectSource = undefined;
        row.collectManual = false;
      } else {
        row.deliverBinNo = '';
        row.deliverValid = undefined;
        row.deliverSource = undefined;
        row.deliverManual = false;
      }
      updated[index] = row;
      return updated;
    });
  };

  // Reveals the manual number entry for a field. This is only reachable after the
  // scanner has been opened (via the in-scanner fallback button) or when the camera
  // permission is denied, ensuring scanning stays the first-choice method.
  const openManualEntry = ({ index, field }: { index: number; field: 'collectBinNo' | 'deliverBinNo' }) => {
    setScannerTarget(null);
    setBinAssignments(prev => {
      const updated = [...prev];
      const row = { ...updated[index] };
      if (field === 'collectBinNo') {
        row.collectManual = true;
        row.collectSource = 'manual';
      } else {
        row.deliverManual = true;
        row.deliverSource = 'manual';
      }
      updated[index] = row;
      return updated;
    });
  };

  const handleSubmit = async () => {
     if (submitting) return; // guard against double-tap
  setSubmitting(true);
    // Validate
    const hasInvalid = binAssignments.some(b =>
      (job?.allows_collect && b.collectBinNo && b.collectValid === false) ||
      (job?.allows_deliver && b.deliverBinNo && b.deliverValid === false)
    );
    if (hasInvalid) {
      Alert.alert('Error', 'Some bin numbers are invalid');
      return;
    }

    if (job?.lug_lock === 1 && selectedLugLocks.length === 0) {
      Alert.alert('Error', 'Please select at least one lug lock');
      return;
    }

    const payload = {
      collect_numbers: binAssignments.filter(b => b.collectBinNo).map(b => ({ bin_number: b.collectBinNo })),
      deliver_numbers: binAssignments.filter(b => b.deliverBinNo).map(b => ({ bin_number: b.deliverBinNo })),
      lug_locks: selectedLugLocks,
    };

    try {
      const response = await makeAuthenticatedRequest(`/execute/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        (navigation as any).navigate('Signature', { jobId });
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to execute task');
    } finally {
        setSubmitting(false);
    }
  };

  

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.container}>
        <Text>Job not found</Text>
      </View>
    );
  }

  const config = {
    showCollect: job.allows_collect === 1,
    showDeliver: job.allows_deliver === 1,
    singleBinOnly: ['Tip And Return', 'Relocate', 'Transport', 'Wait and Load'].includes(job.job_type_name),
    isExchange: job.job_type_name === 'Exchange',
  };

  // Renders a single bin field as either a large scan-first button, a manual entry
  // input, or a read-only confirmation card once a value has been captured.
  const renderBinField = (
    index: number,
    field: 'collectBinNo' | 'deliverBinNo',
    label: string
  ) => {
    const row = binAssignments[index];
    const isCollect = field === 'collectBinNo';
    const value = isCollect ? row.collectBinNo : row.deliverBinNo;
    const valid = isCollect ? row.collectValid : row.deliverValid;
    const manual = isCollect ? row.collectManual : row.deliverManual;
    const source = isCollect ? row.collectSource : row.deliverSource;
    // Preserve the original inputRefs slot mapping so auto-focus still works
    const refSlot = config.isExchange ? (isCollect ? 1 : 0) : (isCollect ? 0 : 1);

    // Manual entry (only reachable after the scanner has been used)
    if (manual) {
      return (
        <View style={styles.inputWithScanContainer}>
          <TextInput
            ref={(ref) => {
              if (!inputRefs.current[index]) inputRefs.current[index] = [];
              inputRefs.current[index][refSlot] = ref;
            }}
            style={[styles.input, styles.flexInput, valid === false && styles.error]}
            placeholder={`Enter ${label} #`}
            value={value}
            onChangeText={(v) => handleBinChange(index, field, v)}
            onBlur={() => validateBinNumber(index, isCollect ? 'collect' : 'deliver', value)}
            keyboardType="numeric"
            maxLength={6}
            autoFocus
          />
          <TouchableOpacity style={styles.scanButton} onPress={() => handleScanPress(index, field)}>
            <MaterialIcons name="qr-code-scanner" size={24} color="#3b82f6" />
          </TouchableOpacity>
        </View>
      );
    }

    // Captured value: show a confirmation card instead of an editable input
    if (value) {
      const statusIcon = valid === false ? 'error-outline' : valid === 'checking' ? 'hourglass-empty' : 'check-circle';
      const statusColor = valid === false ? '#dc2626' : valid === 'checking' ? '#f59e0b' : '#16a34a';
      return (
        <View style={[styles.binCard, valid === false && styles.error]}>
          <View style={styles.binCardLeft}>
            <MaterialIcons name={statusIcon} size={22} color={statusColor} />
            <Text style={[styles.binCardValue, valid === false && styles.binCardValueError]}>{value}</Text>
            {source && (
              <View style={styles.binCardBadge}>
                <Text style={styles.binCardBadgeText}>
                  {source === 'manual' ? 'Manual' : 'Scanned'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.binCardActions}>
            <TouchableOpacity style={styles.rescanButton} onPress={() => handleScanPress(index, field)}>
              <MaterialIcons name="refresh" size={20} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.binClearButton} onPress={() => clearBinField(index, field)}>
              <MaterialIcons name="close" size={20} color="#dc2626" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Empty: scanning is the only primary action
    return (
      <TouchableOpacity style={styles.scanButtonLarge} onPress={() => handleScanPress(index, field)}>
        <MaterialIcons name="qr-code-scanner" size={26} color="#ffffff" />
        <Text style={styles.scanButtonLargeText}>Scan {label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Start Task for Job #{job.job_id}</Text>
      <Text>Job Type: {job.job_type_name}</Text>
      


      {config.isExchange ? (

        <>
          {binAssignments.map((row, index) => (
            <View key={`deliver-${index}`} style={styles.row}>
              <Text>Deliver Bin {index + 1}</Text>
              {renderBinField(index, 'deliverBinNo', 'Deliver Bin')}
            </View>
          ))}
          <View style={styles.divider} />
          {binAssignments.map((row, index) => (
            <View key={`collect-${index}`} style={styles.row}>
              <Text>Collect Bin {index + 1}</Text>
              {renderBinField(index, 'collectBinNo', 'Collect Bin')}
            </View>
          ))}
        </>
      ) : (
        binAssignments.map((row, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.label}>Bin Number {index + 1}</Text>
            {config.singleBinOnly ? (
              renderBinField(index, 'collectBinNo', 'Bin')
            ) : (
              <>
                {config.showCollect && (
                  renderBinField(index, 'collectBinNo', 'Collect Bin')
                )}
                {config.showDeliver && (
                  renderBinField(index, 'deliverBinNo', 'Deliver Bin')
                )}
              </>
            )}
          </View>
        ))
      )}

      {job.lug_lock === 1 && (
        <View style={styles.row}>
          <Text style={styles.label}>Lug Locks Required <Text style={{ color: 'red' }}>*</Text></Text>
          <View style={styles.chipContainer}>
            {selectedLugLocks.map(id => {
              const lock = availableLugLocks.find(l => l.lug_id === id);
              if (!lock) return null;
              return (
                <View key={id} style={styles.chip}>
                  <Text style={styles.chipText}>
                    {lock.display_id} - {lock.type_name} ({lock.colour})
                  </Text>
                  <TouchableOpacity 
                    style={styles.chipRemove} 
                    onPress={() => toggleLugLock(id)}
                  >
                    <Text style={styles.chipRemoveText}>×</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <TouchableOpacity 
              style={styles.addChip} 
              onPress={() => bottomSheetRef.current?.expand()}
            >
              <Text style={styles.addChipText}>
                {selectedLugLocks.length > 0 ? '+ Add More' : 'Tap to select lug lockitems'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </ScrollView>

      {/* Fixed footer: keeps the primary action pinned to the bottom of the screen */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.button, submitting && { opacity: 0.6 }]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>{submitting ? 'Processing...' : 'Next Task'}</Text>
        </TouchableOpacity>
      </View>

      {job.lug_lock === 1 && (
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          onClose={() => setIsBottomSheetOpen(false)}
        >
          <View style={styles.bottomSheetInner}>
            <View style={styles.bottomSheetHeader}>
              <Text style={styles.bottomSheetTitle}>Select Lug Lock for {job.bin_name}</Text>
            </View>
            
            <BottomSheetScrollView style={styles.bottomSheetScroll}>
              {availableLugLocks.length > 0 ? (
                availableLugLocks.map((item: LugLock) => (
                  <TouchableOpacity 
                    key={item.lug_id.toString()}
                    style={[
                      styles.lugItem, 
                      selectedLugLocks.includes(item.lug_id) && styles.selectedLugItem
                    ]}
                    onPress={() => toggleLugLock(item.lug_id)}
                  >
                    <View style={styles.lugInfo}>
                      <Text style={styles.lugKeyCode}>{item.display_id} - {item.key_code}</Text>
                      <Text style={styles.lugDetails}>{item.type_name} - {item.colour}</Text>
                    </View>
                    {selectedLugLocks.includes(item.lug_id) && (
                      <Text style={styles.checkIcon}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text>No available lug locks found for this bin type</Text>
                </View>
              )}
            </BottomSheetScrollView>

            <View style={styles.bottomSheetFooter}>
              <TouchableOpacity 
                style={styles.doneButton} 
                onPress={() => {
                  bottomSheetRef.current?.close();
                  setIsBottomSheetOpen(false);
                }}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheet>
      )}

      {scannerTarget && (
        <Modal visible={true} animationType="slide" onRequestClose={() => setScannerTarget(null)}>
          <View style={styles.scannerContainer}>
            <CameraView
              style={StyleSheet.absoluteFill}
              onBarcodeScanned={(result) => {
                if (result.data) {
                  // Only allow numeric input and limit to 6 digits, simulating keyboard input
                  const numericValue = result.data.replace(/[^0-9]/g, '').substring(0, 6);
                  if (numericValue) {
                    applyScannedValue(scannerTarget.index, scannerTarget.field, numericValue);
                  }
                  setScannerTarget(null);
                }
              }}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_e', 'upc_a'],
              }}
            />
            <View style={[StyleSheet.absoluteFill, styles.scannerOverlay]}>
              <View style={styles.scannerHeader}>
                <TouchableOpacity style={styles.closeScannerBtn} onPress={() => setScannerTarget(null)}>
                  <MaterialIcons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.scannerTarget}>
                <View style={styles.scannerTargetBracket} />
              </View>
              <View style={styles.scannerFooter}>
                <Text style={styles.scannerFooterText}>Align barcode within the frame to scan</Text>
                <TouchableOpacity
                  style={styles.manualFallbackButton}
                  onPress={() => scannerTarget && openManualEntry(scannerTarget)}
                >
                  <MaterialIcons name="keyboard" size={18} color="#3b82f6" />
                  <Text style={styles.manualFallbackText}>No barcode? Enter number manually</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
   

  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  row: {
    marginBottom: 15,
  },
  input: {
    height: 45,
    borderColor: '#d1d5db',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  flexInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
    marginBottom: 0,
  },
  inputWithScanContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  scanButton: {
    height: 45,
    width: 50,
    backgroundColor: '#eff6ff',
    borderColor: '#d1d5db',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  scanButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    gap: 8,
    marginBottom: 10,
  },
  scanButtonLargeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  binCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    borderWidth: 1,
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  binCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  binCardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#101828',
    letterSpacing: 1,
  },
  binCardValueError: {
    color: '#dc2626',
  },
  binCardBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  binCardBadgeText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '600',
  },
  binCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rescanButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  binClearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualFallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  manualFallbackText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    borderColor: 'red',
  },
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerHeader: {
    padding: 20,
    paddingTop: 50,
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
  },
  closeScannerBtn: {
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  scannerTarget: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerTargetBracket: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'transparent',
    borderRadius: 12,
  },
  scannerFooter: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingBottom: 50,
  },
  scannerFooterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: 'gray',
    marginVertical: 10,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f2f4f7',
  },
  scrollContent: {
    paddingBottom: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 4,
  },
  bottomSheetInner: {
    flex: 1,
  },
  bottomSheetHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
    backgroundColor: '#ffffff',
  },
  bottomSheetFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f2f4f7',
    backgroundColor: '#ffffff',
  },
  bottomSheetScroll: {
    flex: 1,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  lugItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f4f7',
  },
  selectedLugItem: {
    backgroundColor: '#f9fafb',
  },
  lugInfo: {
    flex: 1,
  },
  lugKeyCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#101828',
  },
  lugDetails: {
    fontSize: 14,
    color: '#667085',
  },
  checkIcon: {
    fontSize: 18,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: '#3b82f6',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 16,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    color: '#1e40af',
    marginRight: 4,
  },
  chipRemove: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRemoveText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: 'bold',
  },
  addChip: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderStyle: 'dashed',
    backgroundColor: '#f9fafb',
  },
  addChipText: {
    fontSize: 12,
    color: '#6b7280',
  },
});

export default StartTaskScreen;