import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import SignatureCanvas from 'react-native-signature-canvas';
import { useAuth } from '../contexts/AuthContext';
import { generateWasteTransferNote } from '../lib/waste-note';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

const SignatureCaptureScreen = ({ route }: any) => {
    const { jobId } = route.params;
    const navigation = useNavigation();
    const { makeAuthenticatedRequest } = useAuth();

    const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
    const [driverComments, setDriverComments] = useState('');
    const [vehicleReg, setVehicleReg] = useState('');
    const [scrollEnabled, setScrollEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const sigRef = useRef<any>(null);

    const handleSignature = (signature: string) => {
        submitData(signature);
    };

    const handleEmpty = () => {
        submitData(null);
    };

    const handleBegin = () => {
        setScrollEnabled(false);
    };

    const handleEnd = () => {
        setScrollEnabled(true);
    };

    const handleSubmit = () => {
        if (!vehicleReg.trim()) {
            Alert.alert('Required Field', 'Please enter the vehicle registration number.');
            return;
        }
        // Only validate if an email has been entered
        if (customerEmail.trim() && !/^\S+@\S+\.\S+$/.test(customerEmail)) {
            Alert.alert('Invalid Email', 'Please enter a valid customer email address.');
            return;
        }
        if (sigRef.current) {
            sigRef.current.readSignature();
        } else {
            submitData(null);
        }
    };

    const submitData = async (signature: string | null) => {
        setLoading(true);
        try {
            const response = await makeAuthenticatedRequest(`/job/${jobId}/signature`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_signature: signature,
                    driver_comments: driverComments,
                    vehicle_reg: vehicleReg,
                }),
            });

            if (response.ok) {
                Alert.alert('Success', 'Finalized successfully', [
                    {
                        text: 'Finish',
                        onPress: () => {
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Main' as never }],
                            });
                        },
                    },
                ]);
                generateWasteTransferNote(jobId, makeAuthenticatedRequest);
            } else {
                const data = await response.json();
                Alert.alert('Error', data.error || 'Failed to save details');
            }
        } catch (error) {
            Alert.alert('Error', 'Unable to connect to server');
        } finally {
            setLoading(false);
        }
    };

    const sigStyle = `
        .m-signature-pad--footer {display: none; height: 0px;}
        .m-signature-pad {box-shadow: none; border: none;}
        body,html {height: 100%; width: 100%;}
    `;

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    scrollEnabled={scrollEnabled}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.header}>
                        <View style={styles.headerTop}>
                            <TouchableOpacity 
                                style={styles.backButton} 
                                onPress={() => navigation.goBack()}
                            >
                                <Feather name="arrow-left" size={24} color="#1e293b" />
                            </TouchableOpacity>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>Job #{jobId}</Text>
                            </View>
                        </View>
                        <Text style={styles.title}>Finalize Job</Text>
                        <Text style={styles.subtitle}>Complete the information below to finalize the task.</Text>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.inputGroup}>
                            <View style={styles.labelContainer}>
                                <Feather name="truck" size={16} color="#64748b" />
                                <Text style={styles.label}>Vehicle Registration <Text style={{ color: '#ef4444' }}>*</Text></Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. AB12 CDE"
                                placeholderTextColor="#94a3b8"
                                value={vehicleReg}
                                onChangeText={setVehicleReg}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.labelContainer}>
                                <Feather name="message-square" size={16} color="#64748b" />
                                <Text style={styles.label}>Driver Comments</Text>
                            </View>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Add any notes about the job..."
                                placeholderTextColor="#94a3b8"
                                value={driverComments}
                                onChangeText={setDriverComments}
                                multiline
                                numberOfLines={4}
                            />
                        </View>
                    </View>
                    {  /*
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <MaterialCommunityIcons name="account-edit-outline" size={20} color="#3b82f6" />
                            <Text style={styles.cardTitle}>Signing on behalf of customer</Text>
                        </View>
                        
                        <View style={styles.inputGroup}>
                            <View style={styles.labelContainer}>
                                <Feather name="user" size={16} color="#64748b" />
                                <Text style={styles.label}>Customer Name</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter First and Last name"
                                placeholderTextColor="#94a3b8"
                                value={customerName}
                                onChangeText={setCustomerName}
                            />
                        </View>
   <View style={styles.inputGroup}>
                            <View style={styles.labelContainer}>
                                <Feather name="mail" size={16} color="#64748b" />
                                <Text style={styles.label}>Customer Email</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter email address"
                                placeholderTextColor="#94a3b8"
                                value={customerEmail}
                                onChangeText={setCustomerEmail}
                            />
                        </View>
                        <View style={styles.signatureSection}>
                            <View style={styles.labelContainer}>
                                <Feather name="edit-3" size={16} color="#64748b" />
                                <Text style={styles.label}>Signature</Text>
                            </View>
                            <View style={styles.signatureWrapper}>
                                <View style={styles.signaturePad}>
                                    <SignatureCanvas
                                        ref={sigRef}
                                        onOK={handleSignature}
                                        onEmpty={handleEmpty}
                                        onBegin={handleBegin}
                                        onEnd={handleEnd}
                                        autoClear={false}
                                        descriptionText=""
                                        webStyle={sigStyle}
                                        webviewProps={{
                                            scrollEnabled: false,
                                            androidLayerType: 'software'
                                        }}
                                    />
                                </View>
                                <TouchableOpacity
                                    style={styles.clearButton}
                                    onPress={() => sigRef.current?.clearSignature()}
                                >
                                    <View style={styles.clearButtonContent}>
                                        <Feather name="rotate-ccw" size={14} color="#ef4444" />
                                        <Text style={styles.clearButtonText}>Clear</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
*/}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.submitButton, loading && styles.disabledButton]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <View style={styles.buttonContent}>
                                    <Text style={styles.submitButtonText}>Finalize & Save</Text>
                                    <Feather name="check-circle" size={20} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.skipButton}
                            onPress={() => {
                                if (!vehicleReg.trim()) {
                                    Alert.alert('Required Field', 'Please enter the vehicle registration number.');
                                    return;
                                }
                                submitData(null);
                            }}
                            disabled={loading}
                        >
                            <Text style={styles.skipButtonText}>Complete without signature</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    scrollContent: {
        padding: 24,
    },
    header: {
        marginBottom: 32,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
        elevation: 2,
    },
    badge: {
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
    },
    badgeText: {
        color: '#0369a1',
        fontSize: 13,
        fontWeight: '700',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#0f172a',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        color: '#64748b',
        marginTop: 6,
        lineHeight: 22,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
        boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
        marginLeft: 8,
    },
    inputGroup: {
        marginBottom: 20,
    },
    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginLeft: 6,
    },
    input: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#0f172a',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    signatureSection: {
        marginTop: 8,
    },
    signatureWrapper: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
    },
    signaturePad: {
        height: 250,
        backgroundColor: '#fff',
    },
    clearButton: {
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    clearButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    clearButtonText: {
        color: '#ef4444',
        fontWeight: '600',
        fontSize: 14,
        marginLeft: 6,
    },
    footer: {
        marginTop: 12,
        marginBottom: 40,
    },
    submitButton: {
        backgroundColor: '#3b82f6',
        padding: 18,
        borderRadius: 18,
        alignItems: 'center',
        boxShadow: '0px 4px 8px rgba(59, 130, 246, 0.2)',
        elevation: 4,
    },
    buttonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    disabledButton: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
        marginRight: 8,
    },
    skipButton: {
        marginTop: 16,
        padding: 12,
        alignItems: 'center',
    },
    skipButtonText: {
        color: '#64748b',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default SignatureCaptureScreen;

