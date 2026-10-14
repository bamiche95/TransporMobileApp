import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import RelatedBins from '../components/RelatedBins';
import Base_URL from '../lib/config';

interface JobDetail {
  customer_id: number;
  job_id: number;
  customer_name: string;
  company_name: string;
  job_type_name: string;
  bin_name: string;
  qty: number;
  job_datetime: string;
  job_status_name: string;
  company_notes: string;
  jobs_notes: string;
  opening_times: string;
  office_notes: string;
  booking_portal_id: string;
  adr: number;
  lug_lock: number;
  phone_number: string;
  contact_name: string;
  address: string;
  postcode: string;
  city: string;
  town: string;
  country: string;
  sic_code: string;
  priority: string;
  job_date: string;
  tipper: string;
}

const JobDetailScreen = ({ route }: any) => {
  const { jobId } = route.params;
  const navigation = useNavigation();
  const { makeAuthenticatedRequest } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // State to handle expanding job notes
  const [notesExpanded, setNotesExpanded] = useState(false);

  const fetchJobDetail = async () => {
    try {
      const response = await makeAuthenticatedRequest(`/job/${jobId}`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      const data = await response.json();
      if (response.ok) {
        setJob(data.job);
      } else {
        Alert.alert('Error', data.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to fetch job details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchJobDetail();
  };

  useEffect(() => {
    fetchJobDetail();
  }, [jobId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  const handleStartTask = async () => {
    try {
      const response = await makeAuthenticatedRequest(`/job/${jobId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job_status_id: 4 }), // 4 = In Progress
      });

      if (response.ok) {
        const isTransport = job?.job_type_name?.toLowerCase() === 'transport';
        const isFlatbed = job?.bin_name?.toLowerCase() === 'flatbed material transport';

        if (isTransport && isFlatbed) {
          (navigation as any).navigate('Signature', { jobId });
        } else {
          (navigation as any).navigate('StartTask', { jobId });
        }
      } else {
        const data = await response.json();
        Alert.alert('Error', data.error || 'Failed to update job status');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to connect to server');
    }
  };

  const Wrapper = Platform.OS === 'web' ? View : SafeAreaView;

  return (
    <Wrapper style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Job Details</Text>
          <Text style={styles.headerSubtitle}>Job #{job?.job_id}</Text>
        </View>

        {job ? (
          <>
            {/* Job Details Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>📋 Job Information</Text>
              </View>

              <View style={styles.cardContent}>
                <InfoRow label="Customer" value={job.customer_name} highlight />
                <Divider />
                <InfoRow label="Company" value={job.company_name} />
                <Divider />
                <InfoRow label="Job Type" value={job.job_type_name} />
                <Divider />
                <InfoRow label="Bin Type" value={job.bin_name} />
                <Divider />
                <InfoRow label="Job Status" value={job.job_status_name || 'Pending'} />
                <Divider />
                <InfoRow label="Quantity" value={`${job.qty}`} />
                <Divider />
                <InfoRow label="Job Date" value={job.job_date} />
                <Divider />
                <InfoRow label="Priority" value={job.priority} highlight />
                <Divider />
                <InfoRow label="Tip At" value={job.tipper} expandable />
               <Divider />
                <InfoRow label="Opening Times" value={job.opening_times} />
                <Divider />
              </View>

              {/* Notes Section with Show More functionality */}
              {job.jobs_notes && (
                <>
                  <Divider />
                  <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>📝 Job Notes</Text>
                    <Text 
                      style={styles.notesText}
                      numberOfLines={notesExpanded ? undefined : 3}
                    >
                      {job.jobs_notes}
                    </Text>
                    {job.jobs_notes.length > 100 && (
                      <TouchableOpacity onPress={() => setNotesExpanded(!notesExpanded)}>
                        <Text style={styles.showMoreText}>
                          {notesExpanded ? 'Show Less ⬆️' : 'Show More ⬇️'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}
               
            </View>

            {/* Address Details Card */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>📍 Address Details</Text>
              </View>

              <View style={styles.cardContent}>
                {/* Enabled expandable behavior on address via expandable prop */}
                <InfoRow label="Address" value={job.address} expandable />
                 <Divider />
                <InfoRow label="Tip At" value={job.tipper} expandable />
                <Divider />
                <InfoRow label="City" value={job.city} />
                <Divider />
                <InfoRow label="Town" value={job.town} />
                <Divider />
                <InfoRow label="Postcode" value={job.postcode} />
                <Divider />
                <InfoRow label="SIC Code" value={job.sic_code} monospace />
              </View>
            </View>

            {/* Related Bins */}
            <View style={styles.relatedBinsContainer}>
              <RelatedBins customerId={job.customer_id} />
            </View> 
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Unable to load job details</Text>
          </View>
        )}

        {/* Start Task Button */}
        {job && (
          <View style={styles.startTaskContainer}>
            <TouchableOpacity
              style={styles.startTaskButton}
              onPress={handleStartTask}
            >
              <Text style={styles.startTaskButtonText}>🚀 Start Task</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </Wrapper>
  );
};

interface InfoRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  monospace?: boolean;
  expandable?: boolean; // New optional property
}

const InfoRow = ({ label, value, highlight, monospace, expandable }: InfoRowProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View style={[styles.infoRow, expandable && { flexDirection: 'column', alignItems: 'flex-start' }]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={expandable ? styles.expandableValueContainer : styles.standardValueContainer}>
        <Text
          style={[
            styles.infoValue,
            expandable && { textAlign: 'left', marginTop: 4 },
            highlight && styles.infoValueHighlight,
            monospace && styles.infoValueMonospace,
          ]}
          numberOfLines={expandable && !isExpanded ? 2 : undefined}
        >
          {value || '—'}
        </Text>
        {expandable && value && value.length > 40 && (
          <TouchableOpacity onPress={() => setIsExpanded(!isExpanded)}>
            <Text style={styles.showMoreRowText}>
              {isExpanded ? 'Less' : 'More...'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const Divider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: 32,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '300',
    color: '#0f172a',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    letterSpacing: 0.3,
  },

  // Card
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
      }
    }),
  },

  // Card Header
  cardHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    letterSpacing: -0.2,
  },

  // Card Content
  cardContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  // Info Row layouts
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  standardValueContainer: {
    flex: 0.65,
  },
  expandableValueContainer: {
    width: '100%',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    flexShrink: 0,
    letterSpacing: -0.1,
  },
  infoValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
    textAlign: 'right',
  },
  infoValueHighlight: {
    color: '#2563eb',
    fontWeight: '600',
  },
  infoValueMonospace: {
    fontFamily: 'Courier New',
    fontWeight: '400',
    fontSize: 13,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },

  // Notes Section
  notesSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  notesText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    fontWeight: '400',
  },
  showMoreText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 6,
  },
  showMoreRowText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'left',
  },

  // Related Bins
  relatedBinsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // Start Task Button
  startTaskContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  startTaskButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      }
    }),
  },
  startTaskButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Bottom Padding
  bottomPadding: {
    height: 16,
  },
});

export default JobDetailScreen;