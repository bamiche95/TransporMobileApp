import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, BorderRadius, Shadow } from '../constants/Theme';
import { Ionicons } from '@expo/vector-icons';
import SignatureCanvas from 'react-native-signature-canvas';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';

const ProfileScreen = () => {
  const { user, logout, makeAuthenticatedRequest, login } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [signature, setSignature] = React.useState(user?.signature || null);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [scrollEnabled, setScrollEnabled] = React.useState(true);
  const sigRef = React.useRef<any>(null);

  const handleBegin = () => setScrollEnabled(false);
  const handleEnd = () => setScrollEnabled(true);

  const handleLogout = () => {
    logout();
  };

  const handleSignature = async (signature: string) => {
    setLoading(true);
    try {
      const response = await makeAuthenticatedRequest('/users/me/signature', {
        method: 'PUT',
        body: JSON.stringify({ signature }),
      });

      if (response.ok) {
        // Update local user state
        const updatedUser = { ...user, signature };
        await login(updatedUser, (await AsyncStorage.getItem('token')) || '');
        setSignature(signature);
        setIsCapturing(false);
        Alert.alert('Success', 'Signature updated successfully');
      } else {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          Alert.alert('Error', data.error || 'Failed to update signature');
        } catch (e) {
          Alert.alert('Error', `Server error (${response.status}). Please check server logs.`);
          console.error('Server returned non-JSON response:', text);
        }
      }
    } catch (error) {
      console.error('Error saving signature:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const clearSignature = () => {
    sigRef.current?.clearSignature();
  };

  const saveSignature = () => {
    sigRef.current?.readSignature();
  };

  const ProfileItem = ({ icon, label, value }: { icon: any, label: string, value: string }) => (
    <View style={styles.profileItem}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={22} color={Colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemLabel}>{label}</Text>
        <Text style={styles.itemValue}>{value}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={scrollEnabled}
      >
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={50} color={Colors.white} />
          </View>
          <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
          <Text style={styles.userRole}>{user?.role || 'Driver'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Signature</Text>
          <View style={styles.card}>
            {isCapturing ? (
              <View style={styles.signaturePadContainer}>
                <SignatureCanvas
                  ref={sigRef}
                  onOK={handleSignature}
                  onEmpty={() => Alert.alert('Error', 'Please provide a signature')}
                  onBegin={handleBegin}
                  onEnd={handleEnd}
                  descriptionText="Sign here"
                  clearText="Clear"
                  confirmText="Save"
                  webStyle={`
                    .m-signature-pad { box-shadow: none; border: none; } 
                    .m-signature-pad--body { border: none; }
                    .m-signature-pad--footer { display: none; margin: 0px; }
                    body,html { width: 100%; height: 100%; }
                  `}
                  autoClear={false}
                  penColor="#000000"
                  backgroundColor="#ffffff"
                />
                <View style={styles.signatureActions}>
                  <TouchableOpacity style={styles.clearBtn} onPress={clearSignature}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.saveBtn, loading && styles.disabledBtn]} 
                    onPress={saveSignature}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.saveBtnText}>Save Signature</Text>}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsCapturing(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.signaturePreviewContainer}>
                {signature ? (
                  <Image 
                    source={{ uri: signature }} 
                    style={styles.signatureImage} 
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={styles.noSignatureText}>No signature stored</Text>
                )}
                <TouchableOpacity 
                  style={styles.captureButton} 
                  onPress={() => setIsCapturing(true)}
                >
                  <Ionicons name="pencil-outline" size={20} color={Colors.primary} />
                  <Text style={styles.captureButtonText}>
                    {signature ? 'Update Signature' : 'Capture Signature'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.card}>
            <ProfileItem 
              icon="at-outline" 
              label="Username" 
              value={user?.username || '—'} 
            />
            <View style={styles.divider} />
            <ProfileItem 
              icon="mail-outline" 
              label="Email Address" 
              value={user?.email || '—'} 
            />
            <View style={styles.divider} />
            <ProfileItem 
              icon="shield-checkmark-outline" 
              label="Access Role" 
              value={user?.role || '—'} 
            />
          </View>
        </View>

        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Version 1.2.0 (Build 42)</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadow.md,
  },
  userName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  userRole: {
    fontSize: 14,
    color: Colors.textLight,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  section: {
    padding: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textLight,
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 12,
    color: Colors.textLight,
    fontWeight: '500',
  },
  itemValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.error,
    marginTop: Spacing.md,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.error,
    marginLeft: Spacing.sm,
  },
  versionText: {
    textAlign: 'center',
    color: Colors.textLight,
    fontSize: 12,
    marginTop: Spacing.xl,
  },
  signaturePadContainer: {
    height: 300,
    width: '100%',
  },
  signatureActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clearBtnText: {
    color: Colors.text,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: Colors.white,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  cancelBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.textLight,
    fontWeight: '500',
  },
  signaturePreviewContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  signatureImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#f8fafc',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  noSignatureText: {
    color: Colors.textLight,
    fontStyle: 'italic',
    marginBottom: Spacing.md,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  captureButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: Spacing.sm,
  },
});

export default ProfileScreen;

