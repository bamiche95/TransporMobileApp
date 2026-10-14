import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadow } from '../constants/Theme';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Customer {
  customer_id: number;
  customer_name: string;
}

const BinStockScreen = () => {
  const navigation = useNavigation();
  const { makeAuthenticatedRequest } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  const [binNumbers, setBinNumbers] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scannerTarget, setScannerTarget] = useState<number | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length > 2 && !selectedCustomer) {
        searchCustomers();
      } else {
        setCustomers([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchCustomers = async () => {
    setSearchLoading(true);
    try {
      const response = await makeAuthenticatedRequest(`/customers/search?query=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchQuery(customer.customer_name);
    setCustomers([]);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setSearchQuery('');
    setCustomers([]);
  };

  const handleAddBin = () => {
    setBinNumbers([...binNumbers, '']);
  };

  const handleRemoveBin = (index: number) => {
    const updated = [...binNumbers];
    updated.splice(index, 1);
    setBinNumbers(updated.length > 0 ? updated : ['']);
  };

  const handleBinChange = (index: number, value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').substring(0, 6);
    const updated = [...binNumbers];
    updated[index] = numericValue;
    setBinNumbers(updated);
  };

  const handleScanPress = async (index: number) => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Camera permission is required to scan codes');
        return;
      }
    }
    setScannerTarget(index);
  };

  const handleUpdate = async () => {
    if (!selectedCustomer) {
      Alert.alert('Error', 'Please select a customer first');
      return;
    }

    const filteredBins = binNumbers.filter(b => b.trim().length > 0);
    if (filteredBins.length === 0) {
      Alert.alert('Error', 'Please enter at least one bin number');
      return;
    }

    Alert.alert(
      'Confirm Update',
      `Are you sure you want to update ${filteredBins.length} bin(s) to ${selectedCustomer.customer_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            setLoading(true);
            try {
              const response = await makeAuthenticatedRequest('/bins/update-location', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  customer_id: selectedCustomer.customer_id,
                  bin_numbers: filteredBins,
                }),
              });

              if (response.ok) {
                Alert.alert('Success', 'Bin locations updated successfully');
                // Reset form
                handleClearCustomer();
                setBinNumbers(['']);
              } else {
                const data = await response.json();
                Alert.alert('Error', data.error || 'Failed to update bins');
              }
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bin Stock Update</Text>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Customer Search Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Select Customer</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={Colors.textLight} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Type customer name..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              editable={!selectedCustomer}
            />
            {selectedCustomer && (
              <TouchableOpacity onPress={handleClearCustomer} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color={Colors.textLight} />
              </TouchableOpacity>
            )}
            {searchLoading && <ActivityIndicator size="small" color={Colors.primary} style={styles.searchLoader} />}
          </View>

          {customers.length > 0 && !selectedCustomer && (
            <View style={styles.resultsContainer}>
              {customers.map((item) => (
                <TouchableOpacity
                  key={item.customer_id}
                  style={styles.resultItem}
                  onPress={() => handleSelectCustomer(item)}
                >
                  <Text style={styles.resultText}>{item.customer_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Bin Numbers Section */}
        {selectedCustomer && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Bin Numbers</Text>
              <TouchableOpacity style={styles.addButton} onPress={handleAddBin}>
                <Ionicons name="add" size={20} color={Colors.primary} />
                <Text style={styles.addButtonText}>Add More</Text>
              </TouchableOpacity>
            </View>

            {binNumbers.map((bin, index) => (
              <View key={index} style={styles.binRow}>
                <View style={styles.inputWithScanContainer}>
                  <TextInput
                    style={[styles.input, styles.flexInput]}
                    placeholder="Enter Bin #"
                    value={bin}
                    onChangeText={(value) => handleBinChange(index, value)}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <TouchableOpacity style={styles.scanButton} onPress={() => handleScanPress(index)}>
                    <MaterialIcons name="qr-code-scanner" size={24} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                {binNumbers.length > 1 && (
                  <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveBin(index)}>
                    <Ionicons name="trash-outline" size={20} color={Colors.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            <TouchableOpacity
              style={[styles.updateButton, loading && styles.disabledButton]}
              onPress={handleUpdate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.updateButtonText}>Update Bin Locations</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Scanner Modal */}
      {scannerTarget !== null && (
        <Modal visible={true} animationType="slide" onRequestClose={() => setScannerTarget(null)}>
          <View style={styles.scannerContainer}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              onBarcodeScanned={(result) => {
                if (result.data) {
                  const numericValue = result.data.replace(/[^0-9]/g, '').substring(0, 6);
                  if (numericValue) {
                    handleBinChange(scannerTarget, numericValue);
                  }
                  setScannerTarget(null);
                }
              }}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_e', 'upc_a'],
              }}
            />
            <View style={[StyleSheet.absoluteFillObject, styles.scannerOverlay]}>
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
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    height: 50,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  clearButton: {
    padding: Spacing.xs,
  },
  searchLoader: {
    marginLeft: Spacing.xs,
  },
  resultsContainer: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  resultItem: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultText: {
    fontSize: 16,
    color: Colors.text,
  },
  binRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  inputWithScanContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    height: 48,
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    fontSize: 16,
  },
  flexInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
  },
  scanButton: {
    height: 48,
    width: 50,
    backgroundColor: '#eff6ff',
    borderColor: Colors.border,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  removeButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xs,
  },
  addButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  updateButton: {
    backgroundColor: Colors.primary,
    height: 56,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    ...Shadow.md,
  },
  updateButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
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
    borderRadius: 12,
  },
  scannerFooter: {
    padding: 30,
    alignItems: 'center',
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
});

export default BinStockScreen;
